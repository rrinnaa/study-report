import os
from dotenv import load_dotenv

load_dotenv()


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


def get_str_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()

DATABASE_URL = os.getenv("DATABASE_URL")
APP_ENV = os.getenv("APP_ENV", "development").lower()
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"

CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "",
    ).split(",")
    if origin.strip()
]

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 30
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY")
JWT_REFRESH_EXPIRE_DAYS = get_int_env("JWT_REFRESH_EXPIRE_DAYS", 7)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY",)
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "study-reports")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

SITE_URL = get_str_env("SITE_URL", "http://localhost:5173").rstrip("/")

EXTERNAL_API_URL = get_str_env(
    "EXTERNAL_API_URL",
    "https://api.api-ninjas.com/v1/quotes?category=education",
)
EXTERNAL_API_KEY = get_str_env("EXTERNAL_API_KEY", "")
EXTERNAL_API_TIMEOUT_SECONDS = get_int_env("EXTERNAL_API_TIMEOUT_SECONDS", 6)
EXTERNAL_API_MAX_RETRIES = get_int_env("EXTERNAL_API_MAX_RETRIES", 3)
EXTERNAL_API_RATE_LIMIT_PER_MINUTE = get_int_env("EXTERNAL_API_RATE_LIMIT_PER_MINUTE", 20)

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL не задан в .env")