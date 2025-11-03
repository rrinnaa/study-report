from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import User, get_db
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import Optional
import re
from .config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from jose import jwt
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("auth")
router = APIRouter(prefix="/api", tags=["Auth"])
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
PASSWORD_REGEX = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,14}$")

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    class Config:
        from_attributes = True

def validate_password_policy(password: str) -> bool:
    return bool(PASSWORD_REGEX.fullmatch(password or ""))

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

@router.post("/register", status_code=201)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if not validate_password_policy(user.password):
        raise HTTPException(status_code=400, detail="Пароль не соответствует требованиям")
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    hashed_password = get_password_hash(user.password)
    user_data = user.dict(exclude={"password"})
    db_user = User(**user_data, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    token = create_access_token({"sub": db_user.email, "user_id": db_user.id})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse.from_orm(db_user)}

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == data.email).first()
    if not db_user or not verify_password(data.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")
    token = create_access_token({"sub": db_user.email, "user_id": db_user.id})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse.from_orm(db_user)}

@router.get("/profile")
def get_profile(request: Request, db: Session = Depends(get_db)):
    payload = request.state.user
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return UserResponse.from_orm(user)

@router.put("/profile")
def update_profile(request: Request, user_update: UserUpdate, db: Session = Depends(get_db)):
    payload = request.state.user
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user_update.first_name is not None:
        user.first_name = user_update.first_name
    if user_update.last_name is not None:
        user.last_name = user_update.last_name
    if user_update.email is not None:
        existing_user = db.query(User).filter(
            User.email == user_update.email, 
            User.id != user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email уже используется")
        user.email = user_update.email
    
    if user_update.password:
        if not validate_password_policy(user_update.password):
            raise HTTPException(
                status_code=400, 
                detail="Пароль должен содержать минимум 6 символов, одну заглавную букву и одну цифру"
            )
        user.hashed_password = get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(user)
    return UserResponse.from_orm(user)

@router.delete("/profile")
def delete_profile(request: Request, db: Session = Depends(get_db)):
    payload = request.state.user
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return {"message": "Пользователь удален"}