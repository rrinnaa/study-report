from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
import re, logging
from io import BytesIO
import PyPDF2, docx
from .database import get_db
from .database import Analysis
from sqlalchemy.orm import Session
from .ocr_service import ocr_service
from PIL import Image

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
    """Извлекает текст из изображения с помощью OCR"""
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
    request: Request,
    file: UploadFile = File(...),
    work_type: str = None,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    
    try:
        logger.info(f"User {user.get('user_id')} is analyzing file: {file.filename}")

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
                    user_id=user.get("user_id"),
                    filename=filename,
                    score=0,
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
                user_id=user.get("user_id"),
                filename=filename,
                score=0,
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
                user_id=user.get("user_id"),
                filename=filename,
                score=0,
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

        analysis_record = Analysis(
            user_id=user.get("user_id"),
            filename=filename,
            score=score,
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
    request: Request,
    page: int = 1,
    limit: int = 6,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")

    if page < 1:
        page = 1
    if limit < 1 or limit > 50:
        limit = 6

    user_id = user.get("user_id")
    offset = (page - 1) * limit

    total = db.query(Analysis).filter(
        Analysis.user_id == user_id
    ).count()
    
    uploads = (
        db.query(Analysis)
        .filter(Analysis.user_id == user_id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        {
            "id": upload.id,
            "filename": upload.filename,
            "score": upload.score,
            "created_at": upload.created_at.isoformat() if upload.created_at else None
        }
        for upload in uploads
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.delete("/upload/{upload_id}")
def delete_upload(
    upload_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    
    user_id = user.get("user_id")
    
    upload = db.query(Analysis).filter(
        Analysis.id == upload_id,
        Analysis.user_id == user_id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    try:
        db.delete(upload)
        db.commit()
        return {"message": "Запись успешно удалена"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting upload {upload_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при удалении записи")

@router.get("/upload/{upload_id}/details")
def get_upload_details(
    upload_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    
    user_id = user.get("user_id")
    upload = db.query(Analysis).filter(
        Analysis.id == upload_id,
        Analysis.user_id == user_id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    
    if not upload.full_result:
        raise HTTPException(status_code=404, detail="Детали анализа не найдены")
    
    return upload.full_result

@router.post("/analyze-multiple")
async def analyze_multiple_files(
    request: Request,
    files: list[UploadFile] = File(...),
    work_type: str = None,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    
    try:
        logger.info(f"User {user.get('user_id')} is analyzing {len(files)} files")

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
                user_id=user.get("user_id"),
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
    request: Request,
    files: list[UploadFile] = File(...),
    work_type: str = None,
    db: Session = Depends(get_db)
):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")
    
    try:
        logger.info(f"User {user.get('user_id')} is analyzing {len(files)} screenshots as combined document")

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
            user_id=user.get("user_id"),
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