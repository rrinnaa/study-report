# SEO Lab Report

## 1. Классификация страниц MVP

### 1.1 Публичные страницы для индексации
- / (главная, целевая SEO-страница)

### 1.2 Служебные и закрытые страницы (исключены из индексации)
- /auth
- /reports/upload
- /reports/analysis
- /reports/history
- /profile/edit
- /admin/users
- legacy-URL с редиректами: /upload, /analysis, /my-uploads, /edit-profile, /admin

### 1.3 Приоритетные страницы для выдачи
- P1: / (максимальный приоритет, включен в sitemap)
- P2: /robots.txt и /sitemap.xml как технические SEO-ресурсы

## 2. Базовая SEO-оптимизация frontend

- Добавлена динамическая SEO-обвязка: title, description, robots, canonical, Open Graph, Twitter Card.
- Внедрена JSON-LD разметка (тип SoftwareApplication) для главной страницы.
- Добавлена страница 404 внутри SPA.
- Введен единый набор человеко-понятных URL и legacy-редиректы.
- Улучшена семантическая разметка ключевых страниц через main/section и заголовки.

## 3. Техническая SEO-поддержка backend/infrastructure

- Реализованы эндпоинты /sitemap.xml и /robots.txt в FastAPI.
- Настроен проксинг этих маршрутов через Nginx.
- Существующие API-маршруты сохраняют корректные HTTP-статусы 404 и 403.
- Добавлен пример статуса 410 для удаленного legacy-endpoint: /api/legacy/analyze.

## 4. Performance-оптимизации, влияющие на SEO

- Реализован lazy loading тяжелых страниц через React.lazy + Suspense.
- Добавлен lazy loading изображений-превью в Upload.
- Убран дублирующий ручной auth-refresh в Upload в пользу общего apiService.
- Настроено разделение vendor-чанка в Vite build.
- Для визуальной стабильности сохранены фиксированные размеры превью и предсказуемые loading-состояния.

## 5. Интеграция стороннего API

Сценарий: блок Совета по оформлению на главной странице.

- Серверный слой: backend/external_api_service.py.
- Ключи и параметры через env: EXTERNAL_API_URL, EXTERNAL_API_KEY, EXTERNAL_API_TIMEOUT_SECONDS, EXTERNAL_API_MAX_RETRIES, EXTERNAL_API_RATE_LIMIT_PER_MINUTE.
- Обработка отказов: timeout, retries с backoff, rate limiting, fallback-ответ.
- Нормализация ответа: к единому формату { tip, source, is_fallback }.

## 6. Клиентская часть внешних данных

- Отображение данных на главной странице.
- Реализованы состояния loading, error и fallback.
- При недоступности внешнего API UI деградирует корректно: показывается локальный совет без падения страницы.

## 7. Проверка результата

Проверка выполняется командами:
- curl http://127.0.0.1:5173/sitemap.xml
- curl http://127.0.0.1:5173/robots.txt
- curl http://127.0.0.1:5173/api/external/study-tip
- npm run build

Ожидаемый результат:
- sitemap.xml и robots.txt доступны.
- Метатеги/каноникал выставляются динамически по маршрутам.
- Внешний API возвращает нормализованный ответ или fallback.
- Сборка frontend успешна, существующий MVP-функционал сохранен.
