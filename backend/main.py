# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from dotenv import load_dotenv
import os
import re
import logging
import traceback
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 30

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL не задан в .env")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(512), nullable=False)

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer()
PASSWORD_REGEX = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,14}$")

def validate_password_policy(password: str) -> bool:
    return bool(PASSWORD_REGEX.fullmatch(password or ""))

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или просроченный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
       from_attributes = True

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/register", status_code=201)
def register(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    try:
        logger.info("POST /api/register incoming json: %s", user.dict())

        if not validate_password_policy(user.password):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Пароль не соответствует требованиям: "
                    "6-14 символов; латиница и цифры; "
                    "минимум одна заглавная буква; минимум одна цифра."
                ),
            )

        existing = db.query(User).filter(User.email == user.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь уже существует")

        hashed_password = get_password_hash(user.password)
        db_user = User(
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            hashed_password=hashed_password,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        access_token = create_access_token(data={"sub": user.email, "user_id": db_user.id})
        
        logger.info("User created id=%s email=%s", db_user.id, db_user.email)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(db_user)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Exception in /api/register: %s", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error (see server logs)")

@app.post("/api/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    try:
        logger.info("POST /api/login incoming json: %s", data.dict())
        db_user = db.query(User).filter(User.email == data.email).first()
        if not db_user or not verify_password(data.password, db_user.hashed_password):
            raise HTTPException(status_code=401, detail="Неверная почта или пароль")
        
        access_token = create_access_token(data={"sub": db_user.email, "user_id": db_user.id})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(db_user)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Exception in /api/login: %s", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error (see server logs)")

# Защищенные эндпоинты
@app.get("/api/profile")
def get_profile(payload: dict = Depends(verify_token), db: Session = Depends(get_db)):
    user_email = payload.get("sub")
    db_user = db.query(User).filter(User.email == user_email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return UserResponse.from_orm(db_user)

@app.put("/api/profile")
def update_profile(
    user_update: UserCreate,
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user_email = payload.get("sub")
    db_user = db.query(User).filter(User.email == user_email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем, не занят ли email другим пользователем
    if user_update.email != db_user.email:
        existing = db.query(User).filter(User.email == user_update.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email уже используется")
    
    # Обновляем данные
    db_user.first_name = user_update.first_name
    db_user.last_name = user_update.last_name
    db_user.email = user_update.email
    
    # Если пароль изменен, хешируем его
    if user_update.password:
        if not validate_password_policy(user_update.password):
            raise HTTPException(
                status_code=400,
                detail="Пароль не соответствует требованиям безопасности"
            )
        db_user.hashed_password = get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(db_user)
    
    return UserResponse.from_orm(db_user)

@app.delete("/api/profile")
def delete_profile(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user_email = payload.get("sub")
    db_user = db.query(User).filter(User.email == user_email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    db.delete(db_user)
    db.commit()
    
    return {"message": "Пользователь удален"}

@app.post("/api/upload")
def upload_file(
    payload: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user_email = payload.get("sub")
    return {"message": f"Файл загружен пользователем {user_email}"}

@app.get("/api/protected-data")
def get_protected_data(payload: dict = Depends(verify_token)):
    return {
        "message": "Это защищенные данные",
        "user_email": payload.get("sub"),
        "user_id": payload.get("user_id")
    }