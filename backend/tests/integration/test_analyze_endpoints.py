from io import BytesIO

import pytest
from reportlab.pdfgen import canvas


def _pdf_bytes(text: str) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer)
    c.drawString(72, 800, text)
    c.save()
    return buffer.getvalue()


@pytest.mark.integration
def test_analyze_file_success(client, user_headers, monkeypatch):
    test_client, _ = client
    monkeypatch.setattr("backend.analyze.minio_service", None)
    file_content = _pdf_bytes("Лабораторная работа Цель работы Задание Ход работы Вывод")
    res = test_client.post(
        "/api/analyze",
        headers=user_headers,
        files={"file": ("report.pdf", file_content, "application/pdf")},
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["fileName"] == "report.pdf"
    assert "score" in payload
    assert isinstance(payload["sectionsFound"], list)


@pytest.mark.integration
def test_analyze_rejects_without_auth(client):
    test_client, _ = client
    res = test_client.post(
        "/api/analyze",
        files={"file": ("report.txt", b"text", "text/plain")},
    )
    assert res.status_code == 401


@pytest.mark.integration
def test_my_uploads_validation_errors(client, user_headers):
    test_client, _ = client
    res = test_client.get("/api/my-uploads?min_score=100&max_score=10", headers=user_headers)
    assert res.status_code == 400
    assert "min_score не может быть больше max_score" in res.json()["detail"]


@pytest.mark.integration
def test_my_uploads_pagination_and_structure(client, user_headers, monkeypatch):
    test_client, _ = client
    monkeypatch.setattr("backend.analyze.minio_service", None)
    for i in range(2):
        test_client.post(
            "/api/analyze",
            headers=user_headers,
            files={"file": (f"r{i}.txt", b"lab\n\xd0\xa6\xd0\xb5\xd0\xbb\xd1\x8c\n\xd0\x97\xd0\xb0\xd0\xb4\xd0\xb0\xd0\xbd\xd0\xb8\xd0\xb5\n\xd0\xa5\xd0\xbe\xd0\xb4\n\xd0\x92\xd1\x8b\xd0\xb2\xd0\xbe\xd0\xb4", "text/plain")},
        )
    res = test_client.get("/api/my-uploads?page=1&limit=1", headers=user_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["limit"] == 1
    assert "items" in data and isinstance(data["items"], list)
