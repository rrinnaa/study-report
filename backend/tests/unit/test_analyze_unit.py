import pytest

from backend.analyze import analyze_work_structure, detect_work_type


@pytest.mark.unit
def test_detect_work_type_from_filename():
    work_type = detect_work_type("my_course_work.docx", "random text")
    assert work_type == "course_work"


@pytest.mark.unit
def test_analyze_work_structure_finds_required_sections():
    content = """
    Лабораторная работа
    Цель работы
    Задание
    Ход работы
    Вывод
    """
    result = analyze_work_structure(content, "lab_report.txt", "lab_report")
    assert result["detectedType"] == "lab_report"
    assert result["score"] >= 70
    assert any(section["name"] == "Цель работы" and section["found"] for section in result["sectionsFound"])


@pytest.mark.unit
def test_analyze_work_structure_reports_missing_sections():
    content = "Лабораторная работа. Только заголовок."
    result = analyze_work_structure(content, "report.txt", "lab_report")
    assert result["isValid"] is False
    assert len(result["errors"]) > 0
    assert "Отсутствует обязательный раздел" in result["errors"][0]
