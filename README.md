# Study Report Analyzer 🎓

Веб-приложение для автоматического анализа структуры учебных работ с использованием AI. Поддерживает документы и скриншоты с технологией OCR.

## 🌟 Возможности

### 📄 Поддержка форматов
- **PDF документы** - прямое извлечение текста
- **Word документы** (.doc, .docx) - полный анализ содержания
- **Текстовые файлы** (.txt) - быстрая обработка
- **Изображения/Скриншоты** - OCR с поддержкой русского языка

### 🔍 Умный анализ
- **Автоопределение типа работы** (Лабораторные, Курсовые, Рефераты, Дипломы)
- **Проверка структуры** по академическим стандартам
- **Обнаружение разделов** (Титульный лист, Задачи, Цели, Заключение и др.)
- **Оценка качества** с детальными рекомендациями

### 🖼️ Продвинутый OCR
- **Распознавание русского и английского текста**
- **Улучшение качества изображений**
- **Объединение нескольких скриншотов** в один документ

### 👤 Управление пользователями
- **JWT аутентификация**
- **Управление профилем**
- **История загрузок**
- **Персональная аналитика**

## 🐳 Контейнерная архитектура

### Сервисы
- `frontend` (React + Nginx reverse proxy)
- `backend` (FastAPI + Uvicorn)
- `postgres` (PostgreSQL)
- `minio` (объектное хранилище)

### Сетевое взаимодействие
- `edge_net`: входящий трафик в `frontend`
- `backend_net`: внутренний обмен `backend` ↔ `postgres`/`minio`
- `frontend` проксирует `/api/*`, `/robots.txt`, `/sitemap.xml` в `backend`

### Запуск одной командой
```bash
docker compose -f docker-compose.app.yml up -d
```

Проверка:
```bash
./scripts/smoke_test.sh
./scripts/resilience_check.sh
```

### Healthchecks и порядок запуска
- `postgres`: `pg_isready`
- `minio`: `/minio/health/live`
- `backend`: `/api/health`
- `frontend`: проверка `/`
- `depends_on.condition: service_healthy` для корректного старта зависимостей

### Конфигурация и безопасность
- Все ключевые параметры вынесены в `.env` (см. `.env.example`)
- Секреты не коммитятся (`.env`, `backend/.env` в `.gitignore`)
- Для деплоя используются secrets GitHub Actions

## ⚙️ CI/CD

### CI (`.github/workflows/ci.yml`)
- запуск при `push` и `pull_request`
- обязательные проверки:
  - backend тесты
  - frontend тесты
  - e2e тесты
  - валидация `docker-compose`
  - сборка Docker-образов frontend/backend
- на `main/master`: публикация образов в GHCR (`latest` и `${sha}`)

### CD (`.github/workflows/cd.yml`)
- запускается после успешного `CI` на `main`
- выполняет SSH-деплой:
  - `docker compose pull`
  - `docker compose up -d --remove-orphans`

Необходимые secrets для CD:
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_PAT`

