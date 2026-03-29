import pytest


@pytest.mark.integration
def test_admin_endpoint_forbidden_for_user(client, user_headers):
    test_client, _ = client
    res = test_client.get("/api/users", headers=user_headers)
    assert res.status_code == 403
    assert "Недостаточно прав" in res.json()["detail"]


@pytest.mark.integration
def test_admin_endpoint_allows_admin(client, admin_headers):
    test_client, _ = client
    res = test_client.get("/api/users", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.integration
def test_external_study_tip_handles_fallback(client, monkeypatch):
    test_client, _ = client

    async def fake_tip(_client_ip):
        return {"tip": "Fallback tip", "source": "server-fallback", "is_fallback": True}

    monkeypatch.setattr("backend.main.external_study_tip_service.get_study_tip", fake_tip)
    res = test_client.get("/api/external/study-tip")
    assert res.status_code == 200
    data = res.json()
    assert data["is_fallback"] is True
    assert data["source"] == "server-fallback"
