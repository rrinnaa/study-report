import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("MINIO_ACCESS_KEY", "minio-test")
os.environ.setdefault("MINIO_SECRET_KEY", "minio-test-secret")

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.auth import get_password_hash
from backend.database import Base, User, get_db
from backend.main import app


@pytest.fixture
def client(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal
    app.dependency_overrides.clear()


@pytest.fixture
def user_headers(client):
    test_client, _ = client
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "user@example.com",
        "password": "Valid12",
    }
    response = test_client.post("/api/register", json=payload)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client):
    test_client, SessionLocal = client
    db = SessionLocal()
    admin = User(
        first_name="Admin",
        last_name="Root",
        email="admin@example.com",
        hashed_password=get_password_hash("Admin12"),
        role="admin",
    )
    db.add(admin)
    db.commit()
    db.close()
    response = test_client.post(
        "/api/login",
        json={"email": "admin@example.com", "password": "Admin12"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
