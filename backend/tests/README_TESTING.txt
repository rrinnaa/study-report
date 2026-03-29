Тестовая структура:
- backend/tests/unit/*: быстрые unit-тесты сервисной логики
- backend/tests/integration/*: интеграционные тесты endpoint'ов

Маркировка:
- @pytest.mark.unit
- @pytest.mark.integration

Правила именования:
- test_<домен>_<ожидаемое_поведение>
- один файл = один логический модуль
