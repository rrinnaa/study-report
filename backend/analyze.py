from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
import re, logging
from io import BytesIO
from datetime import datetime
import PyPDF2, docx
from .database import get_db
from .database import Analysis, User
from sqlalchemy.orm import Session
from .ocr_service import ocr_service
from PIL import Image
from .dependencies import get_current_user
from .security import require_role
from .minio_service import minio_service
import uuid

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

router = APIRouter(prefix="/api", tags=["Analyzer"])
logger = logging.getLogger("analyzer")

WORK_TYPE_TEMPLATES = {
    'lab_report': {
        'name': 'Лабораторная работа',
        'required_sections': [
            {'id': 'title', 'name': 'Титульный лист/Название', 'patterns': [
                r'лабораторная\s+работа', r'отчет\s+по\s+лабораторной', r'lab\s+report', r'title\s+page'
            ]},
            {'id': 'purpose', 'name': 'Цель работы', 'patterns': [
                r'цель', r'цель\s+работы', r'objective', r'aim'
            ]},
            {'id': 'task', 'name': 'Задание', 'patterns': [
                r'задание', r'задача', r'задачи', r'задания', r'task', r'experiment\s+task'
            ]},
            {'id': 'procedure', 'name': 'Ход работы', 'patterns': [
                r'ход\s+работы', r'ход\s+выполнения', r'методика', r'процедура', r'procedure', r'methods', r'experimental\s+steps'
            ]},
            {'id': 'conclusion', 'name': 'Вывод', 'patterns': [
                r'вывод', r'заключение', r'conclusion', r'results'
            ]}
        ],
        'optional_sections': [
            {'id': 'theory', 'name': 'Теоретическая часть', 'patterns': [
                r'теория', r'теоретическая', r'theory', r'background'
            ]},
            {'id': 'calculations', 'name': 'Расчеты', 'patterns': [
                r'расчет', r'вычислен', r'calculations', r'computations'
            ]}
        ]
    },

    'course_work': {
        'name': 'Курсовая работа', 
        'required_sections': [
            {'id': 'title', 'name': 'Титульный лист', 'patterns': [
                r'курсовая\s+работа', r'курсовой\s+проект', r'course\s+work', r'title\s+page'
            ]},
            {'id': 'contents', 'name': 'Содержание', 'patterns': [
                r'содержание', r'оглавление', r'table\s+of\s+contents', r'index'
            ]},
            {'id': 'introduction', 'name': 'Введение', 'patterns': [
                r'введение', r'introduction'
            ]},
            {'id': 'theory', 'name': 'Теоретическая часть', 'patterns': [
                r'теоретическая\s+часть', r'глава\s+1', r'theoretical\s+part', r'chapter\s+1'
            ]},
            {'id': 'practice', 'name': 'Практическая часть', 'patterns': [
                r'практическая\s+часть', r'глава\s+2', r'исследование', r'practical\s+part', r'experiment', r'research'
            ]},
            {'id': 'conclusion', 'name': 'Заключение', 'patterns': [
                r'заключение', r'выводы', r'conclusion', r'results'
            ]},
            {'id': 'bibliography', 'name': 'Список литературы', 'patterns': [
                r'список\s+литературы', r'библиография', r'references', r'bibliography'
            ]}
        ],
        'optional_sections': [
            {'id': 'appendix', 'name': 'Приложения', 'patterns': [
                r'приложение', r'appendix', r'annex'
            ]}
        ]
    },

    'essay': {
        'name': 'Реферат/Эссе',
        'required_sections': [
            {'id': 'title', 'name': 'Титульный лист', 'patterns': [
                r'реферат', r'эссе', r'essay', r'title\s+page'
            ]},
            {'id': 'introduction', 'name': 'Введение', 'patterns': [
                r'введение', r'introduction'
            ]},
            {'id': 'main_part', 'name': 'Основная часть', 'patterns': [
                r'основная\s+часть', r'main\s+part', r'body'
            ]},
            {'id': 'conclusion', 'name': 'Заключение', 'patterns': [
                r'заключение', r'conclusion', r'results'
            ]}
        ],
        'optional_sections': [
            {'id': 'bibliography', 'name': 'Список литературы', 'patterns': [
                r'список\s+литературы', r'bibliography', r'references'
            ]}
        ]
    },

    'thesis': {
        'name': 'Дипломная работа',
        'required_sections': [
            {'id': 'title', 'name': 'Титульный лист', 'patterns': [
                r'дипломная\s+работа', r'выпускная\s+квалификационная', r'thesis', r'title\s+page'
            ]},
            {'id': 'abstract', 'name': 'Аннотация', 'patterns': [
                r'аннотация', r'реферат', r'abstract', r'summary'
            ]},
            {'id': 'contents', 'name': 'Содержание', 'patterns': [
                r'содержание', r'table\s+of\s+contents', r'оглавление'
            ]},
            {'id': 'introduction', 'name': 'Введение', 'patterns': [
                r'введение', r'introduction'
            ]},
            {'id': 'chapters', 'name': 'Главы (3-4)', 'patterns': [
                r'глава\s+[1-4]', r'chapter\s+[1-4]'
            ]},
            {'id': 'conclusion', 'name': 'Заключение', 'patterns': [
                r'заключение', r'выводы', r'conclusion'
            ]},
            {'id': 'bibliography', 'name': 'Список литературы', 'patterns': [
                r'список\s+литературы', r'библиография', r'references', r'bibliography'
            ]},
            {'id': 'appendix', 'name': 'Приложения', 'patterns': [
                r'приложение', r'appendix', r'annex'
            ]}
        ]
    }
}

def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        pdf_file = BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = "".join([page.extract_text() + "\n" for page in pdf_reader.pages])
        return text
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""

def extract_text_from_docx(file_content: bytes) -> str:
    try:
        doc_file = BytesIO(file_content)
        doc = docx.Document(doc_file)
        text = "\n".join([p.text for p in doc.paragraphs])
        return text
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        return ""

def extract_text_from_txt(file_content: bytes) -> str:
    for enc in ['utf-8', 'latin-1', 'cp1251']:
        try:
            return file_content.decode(enc)
        except:
            continue
    return ""

def extract_text_from_image(file_content: bytes) -> str:
    try:
        image = Image.open(BytesIO(file_content))
        image.verify()
        
        text = ocr_service.recognize_text(file_content)
        
        if text:
            logger.info(f"Successfully extracted {len(text)} chars from image")
        else:
            logger.warning("No text found in image")
            
        return text
        
    except Exception as e:
        logger.error(f"Image extraction error: {e}")
        return ""

def generate_report_pdf(analysis_result: dict, user_full_name: str) -> bytes:
    """Генерирует PDF-отчёт по результатам анализа."""
    buffer = BytesIO()
    _register_cyrillic_font()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    font_name = "DejaVuSans" if _cyrillic_font_available() else "Helvetica"
    font_bold = "DejaVuSans-Bold" if _cyrillic_font_available() else "Helvetica-Bold"

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle("Title", fontName=font_bold, fontSize=16, spaceAfter=6, textColor=colors.HexColor("#1e293b"))
    style_subtitle = ParagraphStyle("Subtitle", fontName=font_name, fontSize=11, spaceAfter=4, textColor=colors.HexColor("#64748b"))
    style_section = ParagraphStyle("Section", fontName=font_bold, fontSize=12, spaceBefore=12, spaceAfter=4, textColor=colors.HexColor("#334155"))
    style_body = ParagraphStyle("Body", fontName=font_name, fontSize=10, spaceAfter=3, textColor=colors.HexColor("#1e293b"), leading=14)
    style_ok = ParagraphStyle("Ok", fontName=font_name, fontSize=10, spaceAfter=3, textColor=colors.HexColor("#16a34a"), leading=14)
    style_err = ParagraphStyle("Err", fontName=font_name, fontSize=10, spaceAfter=3, textColor=colors.HexColor("#dc2626"), leading=14)
    style_warn = ParagraphStyle("Warn", fontName=font_name, fontSize=10, spaceAfter=3, textColor=colors.HexColor("#d97706"), leading=14)

    score = analysis_result.get("score", 0)
    score_color = colors.HexColor("#16a34a") if score >= 80 else (colors.HexColor("#d97706") if score >= 60 else colors.HexColor("#dc2626"))

    story = []

    story.append(Paragraph("Отчёт об анализе учебной работы", style_title))
    story.append(Paragraph(f"Студент: {user_full_name}", style_subtitle))
    story.append(Paragraph(f"Файл: {analysis_result.get('fileName', '—')}", style_subtitle))
    story.append(Paragraph(f"Дата: {datetime.utcnow().strftime('%d.%m.%Y %H:%M')} UTC", style_subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=8))

    score_style = ParagraphStyle("Score", fontName=font_bold, fontSize=28, textColor=score_color, spaceAfter=2)
    story.append(Paragraph(f"Итоговый балл: {score}/100", score_style))
    work_type = analysis_result.get("workType", "Не определён")
    story.append(Paragraph(f"Тип работы: {work_type}", style_body))
    is_valid = analysis_result.get("isValid", False)
    status_text = "✓ Работа соответствует требованиям" if is_valid else "✗ Работа не соответствует требованиям"
    status_style = style_ok if is_valid else style_err
    story.append(Paragraph(status_text, status_style))
    story.append(Spacer(1, 8))

    sections_found = analysis_result.get("sectionsFound", [])
    if sections_found:
        story.append(Paragraph("Структура работы", style_section))
        for sec in sections_found:
            found = sec.get("found", False)
            optional = sec.get("optional", False)
            name = sec.get("name", "")
            prefix = "✓" if found else ("○" if optional else "✗")
            sec_style = style_ok if found else (style_warn if optional else style_err)
            label = " (необязательный)" if optional else ""
            story.append(Paragraph(f"{prefix} {name}{label}", sec_style))

    errors = analysis_result.get("errors", [])
    if errors:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Ошибки", style_section))
        for err in errors:
            story.append(Paragraph(f"• {err}", style_err))

    warnings = analysis_result.get("warnings", [])
    if warnings:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Предупреждения", style_section))
        for w in warnings:
            story.append(Paragraph(f"• {w}", style_warn))

    recommendations = analysis_result.get("recommendations", [])
    if recommendations:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Рекомендации", style_section))
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", style_body))

    details = analysis_result.get("structureDetails", {})
    if details:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Детали проверки", style_section))
        table_data = [
            ["Параметр", "Значение"],
            ["Обязательных разделов найдено", f"{details.get('requiredSectionsFound', 0)} / {details.get('totalRequiredSections', 0)}"],
            ["Всего разделов проверено", str(details.get("totalSectionsChecked", 0))],
            ["Объём текста (символов)", str(details.get("contentLength", 0))],
            ["Уверенность определения типа", details.get("detectionConfidence", "—")],
        ]
        table = Table(table_data, colWidths=[10 * cm, 6 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("FONTNAME", (0, 0), (-1, 0), font_bold),
            ("FONTNAME", (0, 1), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(table)

    doc.build(story)
    return buffer.getvalue()


def _register_cyrillic_font():
    """Регистрирует шрифт с поддержкой кириллицы, если доступен."""
    try:
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial.ttf",
        ]
        regular = next((p for p in font_paths if os.path.exists(p) and "Bold" not in p), None)
        bold = next((p for p in font_paths if os.path.exists(p) and "Bold" in p), None)

        if regular:
            pdfmetrics.registerFont(TTFont("DejaVuSans", regular))
        if bold:
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold))
    except Exception:
        pass


def _cyrillic_font_available() -> bool:
    try:
        pdfmetrics.getFont("DejaVuSans")
        return True
    except Exception:
        return False


def detect_work_type(filename: str, content: str) -> str:
    filename_lower = filename.lower()
    content_lower = content.lower()
    
    mapping = {
        'course_work': ['курсовая', 'coursework', 'course_work'],
        'lab_report': ['лабораторная', 'lab', 'отчет', 'laboratory'],
        'essay': ['реферат', 'эссе', 'essay'],
        'thesis': ['диплом', 'thesis', 'вкр', 'дипломная']
    }
    
    for work_type, keywords in mapping.items():
        if any(k in filename_lower for k in keywords) or any(re.search(k, content_lower) for k in keywords):
            return work_type

    length = len(content)
    if length > 30000: return 'thesis'
    elif length > 15000: return 'course_work'
    elif length > 5000: return 'essay'
    else: return 'lab_report'

def analyze_work_structure(content: str, filename: str, work_type: str = None) -> dict:
    if not work_type:
        work_type = detect_work_type(filename, content)
    
    template = WORK_TYPE_TEMPLATES.get(work_type, WORK_TYPE_TEMPLATES['lab_report'])
    
    analysis_result = {
        'fileName': filename,
        'fileType': 'document',
        'workType': template['name'],
        'detectedType': work_type,
        'isValid': False,
        'score': 0,
        'sectionsFound': [],
        'sectionsMissing': [],
        'errors': [],
        'warnings': [],
        'recommendations': [],
        'structureDetails': {}
    }
    
    required_found = 0
    for section in template['required_sections']:
        found = any(re.search(p, content, re.IGNORECASE) for p in section['patterns'])
        analysis_result['sectionsFound'].append({**section, 'found': found})
        if found:
            required_found += 1
        else:
            analysis_result['sectionsMissing'].append(section['name'])
            analysis_result['errors'].append(f"Отсутствует обязательный раздел: {section['name']}")
    
    for section in template.get('optional_sections', []):
        found = any(re.search(p, content, re.IGNORECASE) for p in section['patterns'])
        analysis_result['sectionsFound'].append({**section, 'found': found, 'optional': True})
        if not found:
            analysis_result['recommendations'].append(f"Рекомендуется добавить: {section['name']}")
    
    analyze_specific_rules(content, analysis_result, work_type)
    
    total_required = len(template['required_sections'])
    score_percentage = (required_found / total_required) * 80 if total_required > 0 else 0
    bonus = calculate_bonus(content, work_type)
    penalty = len(analysis_result['errors']) * 5
    final_score = max(0, min(100, score_percentage + bonus - penalty))
    
    analysis_result['score'] = round(final_score)
    analysis_result['isValid'] = len(analysis_result['errors']) == 0 and final_score >= 70
    analysis_result['structureDetails'] = {
        'totalSectionsChecked': len(analysis_result['sectionsFound']),
        'requiredSectionsFound': required_found,
        'totalRequiredSections': total_required,
        'contentLength': len(content),
        'detectionConfidence': 'high' if work_type == analysis_result['detectedType'] else 'medium'
    }
    return analysis_result

def analyze_specific_rules(content: str, analysis_result: dict, work_type: str):
    content_lower = content.lower()
    if work_type == 'lab_report':
        if not re.search(r'\d+\.\s+|\n\s*\d+\)', content):
            analysis_result['warnings'].append("Рекомендуется оформить ход работы в виде нумерованных шагов")
        if not any(w in content_lower for w in ['эксперимент', 'опыт', 'исследование', 'результат']):
            analysis_result['warnings'].append("Рекомендуется добавить описание эксперимента или исследований")
    elif work_type == 'course_work':
        if len(content) < 8000:
            analysis_result['warnings'].append("Объем курсовой работы может быть недостаточным (рекомендуется 10-30 страниц)")
        if not re.search(r'\[\d+\]', content) and not re.search(r'\([А-Яа-я]+\s*,\s*\d{4}\)', content):
            analysis_result['recommendations'].append("Рекомендуется добавить ссылки на литературу в тексте")
    elif work_type == 'thesis':
        if len(content) < 20000:
            analysis_result['errors'].append("Объем дипломной работы недостаточен (рекомендуется 40-80 страниц)")
        chapter_count = len(re.findall(r'глава\s+[1-4]', content_lower))
        if chapter_count < 2:
            analysis_result['errors'].append("Дипломная работа должна содержать не менее 2 глав")

def calculate_bonus(content: str, work_type: str) -> int:
    bonus = 0
    content_lower = content.lower()
    if re.search(r'\bстр\.\s*\d+|\bс\.\s*\d+|\bpage\s*\d+', content_lower):
        bonus += 5
    if re.search(r'рис\.|рисунок|таблица|table|figure', content_lower, re.IGNORECASE):
        bonus += 5
    if re.search(r'\d+\.\d+', content) or re.search(r'[a-zA-Z]\.\d+', content):
        bonus += 10
    if work_type == 'thesis' and len(content) > 40000: bonus += 5
    elif work_type == 'course_work' and len(content) > 15000: bonus += 5
    return bonus

@router.post("/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    work_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        logger.info(f"User {current_user.id} is analyzing file: {file.filename}")

        if not file.filename:
            raise HTTPException(status_code=400, detail="Имя файла не указано")

        content = await file.read()
        filename = file.filename
        file_content_type = file.content_type or ""
        text_content = ""


        if file_content_type == 'application/pdf' or filename.lower().endswith('.pdf'):
            text_content = extract_text_from_pdf(content)
        elif file_content_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'] or filename.lower().endswith(('.doc', '.docx')):
            text_content = extract_text_from_docx(content)
        elif file_content_type == 'text/plain' or filename.lower().endswith('.txt'):
            text_content = extract_text_from_txt(content)
        elif file_content_type.startswith('image/') or filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff')):
            text_content = extract_text_from_image(content)
            
            if not text_content.strip():
                analysis_record = Analysis(
                    user_id=current_user.id,
                    filename=filename,
                    score=0,
                    file_object_name=None,
                    full_result={
                        'fileName': filename,
                        'score': 0,
                        'status': 'no_text_in_image',
                        'isValid': False,
                        'workType': 'Не определен',
                        'fileType': 'image',
                        'detectedType': 'unknown',
                        'sectionsFound': [],
                        'sectionsMissing': [],
                        'errors': ['Не удалось распознать текст на изображении'],
                        'warnings': [
                            'Убедитесь, что изображение четкое',
                            'Текст должен быть хорошо виден', 
                            'Попробуйте сделать фото при хорошем освещении'
                        ],
                        'recommendations': [
                            'Используйте скриншоты вместо фото документов',
                            'Убедитесь что текст не размыт',
                            'Попробуйте увеличить контрастность изображения'
                        ],
                        'structureDetails': {
                            'totalSectionsChecked': 0,
                            'requiredSectionsFound': 0,
                            'totalRequiredSections': 0,
                            'contentLength': 0,
                            'detectionConfidence': 'low'
                        }
                    }
                )
                db.add(analysis_record)
                db.commit()
                return analysis_record.full_result
        else:
            analysis_record = Analysis(
                user_id=current_user.id,
                filename=filename,
                score=0,
                file_object_name=None,
                full_result={
                    'fileName': filename,
                    'score': 0,
                    'status': 'unsupported_format',
                    'isValid': False,
                    'workType': 'Не определен',
                    'fileType': 'unsupported',
                    'detectedType': 'unknown',
                    'sectionsFound': [],
                    'sectionsMissing': [],
                    'errors': ['Формат файла не поддерживается'],
                    'warnings': [],
                    'recommendations': ['Загрузите PDF, DOCX, TXT или изображения (JPG, PNG, etc.)'],
                    'structureDetails': {
                        'totalSectionsChecked': 0,
                        'requiredSectionsFound': 0,
                        'totalRequiredSections': 0,
                        'contentLength': 0,
                        'detectionConfidence': 'low'
                    }
                }
            )
            db.add(analysis_record)
            db.commit()
            return analysis_record.full_result

        if not text_content.strip():
            analysis_record = Analysis(
                user_id=current_user.id,
                filename=filename,
                score=0,
                file_object_name=None,
                full_result={
                    'fileName': filename,
                    'score': 0,
                    'status': 'empty_file',
                    'isValid': False,
                    'workType': 'Не определен',
                    'fileType': 'empty',
                    'detectedType': 'unknown',
                    'sectionsFound': [],
                    'sectionsMissing': [],
                    'errors': ['Не удалось извлечь текст из файла'],
                    'warnings': [],
                    'recommendations': ['Файл должен содержать текст'],
                    'structureDetails': {
                        'totalSectionsChecked': 0,
                        'requiredSectionsFound': 0,
                        'totalRequiredSections': 0,
                        'contentLength': 0,
                        'detectionConfidence': 'low'
                    }
                }
            )
            db.add(analysis_record)
            db.commit()
            return analysis_record.full_result

        analysis_result = analyze_work_structure(text_content, filename, work_type)
        score = analysis_result.get('score', 0)

        report_object_name = None
        if minio_service:
            try:
                user_full_name = f"{current_user.first_name} {current_user.last_name}"
                pdf_bytes = generate_report_pdf(analysis_result, user_full_name)
                report_object_name = f"reports/{current_user.id}/{uuid.uuid4()}.pdf"
                minio_service.upload_file(report_object_name, pdf_bytes, "application/pdf")
                logger.info(f"PDF-отчёт сохранён: {report_object_name}")
            except Exception as minio_err:
                logger.warning(f"Не удалось сохранить PDF-отчёт в MinIO: {minio_err}")
                report_object_name = None

        analysis_record = Analysis(
            user_id=current_user.id,
            filename=filename,
            score=score,
            file_object_name=report_object_name,
            full_result=analysis_result
        )

        db.add(analysis_record)
        db.commit()
        db.refresh(analysis_record)

        return analysis_result

    except Exception as e:
        logger.error(f"Error analyzing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе файла: {str(e)}")

@router.get("/my-uploads")
def get_my_uploads(
    page: int = 1,
    limit: int = 6,
    search: str = None,
    min_score: int = None,
    max_score: int = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if page < 1: page = 1
    if limit < 1 or limit > 50: limit = 6
    if sort_by not in ["created_at", "score", "filename"]: sort_by = "created_at"
    if sort_order not in ["asc", "desc"]: sort_order = "desc"
    if min_score is not None and min_score < 0:
        raise HTTPException(status_code=400, detail="min_score должен быть >= 0")
    if max_score is not None and max_score < 0:
        raise HTTPException(status_code=400, detail="max_score должен быть >= 0")
    if min_score is not None and max_score is not None and min_score > max_score:
        raise HTTPException(status_code=400, detail="min_score не может быть больше max_score")

    offset = (page - 1) * limit
    query = db.query(Analysis).filter(Analysis.user_id == current_user.id)
    
    if search: query = query.filter(Analysis.filename.ilike(f"%{search}%"))
    if min_score is not None: query = query.filter(Analysis.score >= min_score)
    if max_score is not None: query = query.filter(Analysis.score <= max_score)
    
    total = query.count()
    
    sort_column = getattr(Analysis, sort_by)
    query = query.order_by(sort_column.desc() if sort_order == "desc" else sort_column.asc())
    
    uploads = query.offset(offset).limit(limit).all()

    return {
        "items": [
            {
                "id": upload.id,
                "filename": upload.filename,
                "score": upload.score,
                "created_at": upload.created_at.isoformat() if upload.created_at else None,
                "has_file": bool(upload.file_object_name)
            }
            for upload in uploads
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "filters": {
            "search": search,
            "min_score": min_score,
            "max_score": max_score,
            "sort_by": sort_by,
            "sort_order": sort_order
        }
    }

@router.get("/upload/{upload_id}/details")
def get_upload_details(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Analysis).filter(Analysis.id == upload_id).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    if current_user.role != "admin" and upload.user_id != current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="У вас нет доступа к этому анализу"
        )
    
    if not upload.full_result:
        raise HTTPException(status_code=404, detail="Детали анализа не найдены")
    
    return upload.full_result

@router.delete("/upload/{upload_id}")
def delete_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload = db.query(Analysis).filter(Analysis.id == upload_id).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    if current_user.role != "admin" and upload.user_id != current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="У вас нет прав на удаление этого анализа"
        )
    
    try:
        if upload.file_object_name and minio_service:
            try:
                minio_service.delete_file(upload.file_object_name)
            except Exception as minio_err:
                logger.warning(f"Не удалось удалить файл из MinIO: {minio_err}")

        db.delete(upload)
        db.commit()
        return {"message": "Запись успешно удалена"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting upload {upload_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при удалении записи")

@router.get("/upload/{upload_id}/download-url")
def get_file_download_url(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Возвращает временную ссылку для скачивания оригинального файла из MinIO."""
    upload = db.query(Analysis).filter(Analysis.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    if current_user.role != "admin" and upload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому файлу")

    if not upload.file_object_name:
        raise HTTPException(status_code=404, detail="Файл не был сохранён в хранилище")

    if not minio_service:
        raise HTTPException(status_code=503, detail="Сервис хранилища недоступен")

    try:
        url = minio_service.get_presigned_url(upload.file_object_name, expires_hours=1)
        base_name = upload.filename.rsplit(".", 1)[0] if "." in upload.filename else upload.filename
        report_filename = f"report_{base_name}.pdf"
        return {"download_url": url, "filename": report_filename}
    except Exception as e:
        logger.error(f"Ошибка получения ссылки для скачивания: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении ссылки для скачивания")

@router.post("/analyze-multiple")
async def analyze_multiple_files(
    files: list[UploadFile] = File(...),
    work_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        logger.info(f"User {current_user.id} is analyzing {len(files)} files")

        if not files:
            raise HTTPException(status_code=400, detail="Файлы не указаны")

        results = []
        analysis_records = []

        for file in files:
            file_content = await file.read()
            filename = file.filename
            file_content_type = file.content_type or ""
            text_content = ""

            if file_content_type == 'application/pdf' or filename.lower().endswith('.pdf'):
                text_content = extract_text_from_pdf(file_content)
            elif file_content_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'] or filename.lower().endswith(('.doc', '.docx')):
                text_content = extract_text_from_docx(file_content)
            elif file_content_type == 'text/plain' or filename.lower().endswith('.txt'):
                text_content = extract_text_from_txt(file_content)
            elif file_content_type.startswith('image/') or filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff')):
                text_content = extract_text_from_image(file_content)
            else:
                continue

            if not text_content.strip():
                analysis_result = {
                    'fileName': filename,
                    'score': 0,
                    'status': 'empty_file',
                    'isValid': False,
                    'workType': 'Не определен',
                    'fileType': 'empty',
                    'detectedType': 'unknown',
                    'sectionsFound': [],
                    'sectionsMissing': [],
                    'errors': ['Не удалось извлечь текст из файла'],
                    'warnings': [],
                    'recommendations': ['Файл должен содержать текст'],
                    'structureDetails': {
                        'totalSectionsChecked': 0,
                        'requiredSectionsFound': 0,
                        'totalRequiredSections': 0,
                        'contentLength': 0,
                        'detectionConfidence': 'low'
                    }
                }
            else:
                analysis_result = analyze_work_structure(text_content, filename, work_type)

            score = analysis_result.get('score', 0)
            analysis_record = Analysis(
                user_id=current_user.id,
                filename=filename,
                score=score,
                full_result=analysis_result
            )
            db.add(analysis_record)
            analysis_records.append(analysis_record)
            results.append(analysis_result)

        db.commit()

        return {
            "totalFiles": len(files),
            "processedFiles": len(results),
            "results": results
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error analyzing multiple files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе файлов: {str(e)}")

@router.post("/analyze-screenshots")
async def analyze_screenshots(
    files: list[UploadFile] = File(...),
    work_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        logger.info(f"User {current_user.id} is analyzing {len(files)} screenshots as combined document")

        if not files:
            raise HTTPException(status_code=400, detail="Скриншоты не указаны")

        combined_text = ""
        valid_files = []
        invalid_files = []

        for file in files:
            try:
                content = await file.read()
                filename = file.filename
                
                if not (file.content_type.startswith('image/') or filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'))):
                    invalid_files.append(filename)
                    continue

                text_content = extract_text_from_image(content)
                
                if text_content.strip():
                    combined_text += f"\n\n{text_content}"
                    valid_files.append(filename)
                    logger.info(f"Extracted {len(text_content)} chars from {filename}")
                else:
                    invalid_files.append(filename)
                    logger.warning(f"No text found in {filename}")

            except Exception as e:
                logger.error(f"Error processing screenshot {file.filename}: {str(e)}")
                invalid_files.append(file.filename)
                continue

        if not combined_text.strip():
            raise HTTPException(
                status_code=400, 
                detail="Не удалось распознать текст ни на одном из скриншотов. Убедитесь, что скриншоты содержат четкий текст."
            )

        main_filename = valid_files[0] if valid_files else "combined_screenshots"
        
        analysis_result = analyze_work_structure(combined_text, main_filename, work_type)
        
        analysis_result['fileDetails'] = {
            'totalScreenshots': len(files),
            'validScreenshots': len(valid_files),
            'invalidScreenshots': len(invalid_files),
            'validFiles': valid_files,
            'invalidFiles': invalid_files,
            'combinedTextLength': len(combined_text)
        }

        score = analysis_result.get('score', 0)
        analysis_record = Analysis(
            user_id=current_user.id,
            filename=f"combined_screenshots_{len(files)}_files",
            score=score,
            full_result=analysis_result
        )

        db.add(analysis_record)
        db.commit()
        db.refresh(analysis_record)

        return analysis_result

    except Exception as e:
        db.rollback()
        logger.error(f"Error analyzing screenshots: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе скриншотов: {str(e)}")

@router.get("/all-analyses")
def get_all_analyses(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    min_score: int = None,
    max_score: int = None,
    user_id: int = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if page < 1: page = 1
    if limit < 1 or limit > 100: limit = 10
    if sort_by not in ["created_at", "score", "filename", "user_id"]: sort_by = "created_at"
    if sort_order not in ["asc", "desc"]: sort_order = "desc"
    
    offset = (page - 1) * limit
    query = db.query(Analysis)
    
    if search: query = query.filter(Analysis.filename.ilike(f"%{search}%"))
    if min_score is not None: query = query.filter(Analysis.score >= min_score)
    if max_score is not None: query = query.filter(Analysis.score <= max_score)
    if user_id is not None: query = query.filter(Analysis.user_id == user_id)
    
    total = query.count()
    
    sort_column = getattr(Analysis, sort_by)
    query = query.order_by(sort_column.desc() if sort_order == "desc" else sort_column.asc())
    
    analyses = query.offset(offset).limit(limit).all()
    
    return {
        "items": [
            {
                "id": analysis.id,
                "user_id": analysis.user_id,
                "filename": analysis.filename,
                "score": analysis.score,
                "created_at": analysis.created_at.isoformat() if analysis.created_at else None
            }
            for analysis in analyses
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "filters": {
            "search": search,
            "min_score": min_score,
            "max_score": max_score,
            "user_id": user_id,
            "sort_by": sort_by,
            "sort_order": sort_order
        }
    }