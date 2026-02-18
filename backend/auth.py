from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import User, get_db
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import Optional
from .security import require_role
from .dependencies import get_current_user
import re
from .config import (
    JWT_SECRET_KEY, 
    JWT_ALGORITHM, 
    JWT_EXPIRE_MINUTES,
    JWT_REFRESH_SECRET_KEY,
    JWT_REFRESH_EXPIRE_DAYS
)
from jose import jwt, JWTError
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
    role: str
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    
class RoleUpdate(BaseModel):
    role: str

class RefreshRequest(BaseModel):
    refresh_token: str

def validate_password_policy(password: str) -> bool:
    return bool(PASSWORD_REGEX.fullmatch(password or ""))

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=JWT_REFRESH_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_REFRESH_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None

def verify_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_REFRESH_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None

def create_tokens(user: User) -> dict:
    token_data = {"sub": user.email, "user_id": user.id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    return {"access_token": access_token, "refresh_token": refresh_token}

@router.post("/register", status_code=201, response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if not validate_password_policy(user.password):
        raise HTTPException(
            status_code=400, 
            detail="Пароль должен содержать 6-14 символов, одну заглавную букву и одну цифру"
        )
    
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    hashed_password = get_password_hash(user.password)
    user_data = user.model_dump(exclude={"password"})
    db_user = User(**user_data, hashed_password=hashed_password)
    
    tokens = create_tokens(db_user)
    db_user.refresh_token = tokens["refresh_token"]
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(db_user)
    )

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == credentials.email).first()
    if not db_user or not verify_password(credentials.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")
    
    tokens = create_tokens(db_user)
    db_user.refresh_token = tokens["refresh_token"]
    db.commit()
    db.refresh(db_user)
    
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(db_user)
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    refresh_token = request.refresh_token
    
    payload = verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Невалидный refresh token")
    
    user_email = payload.get("sub")
    db_user = db.query(User).filter(
        User.email == user_email,
        User.refresh_token == refresh_token
    ).first()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Refresh token не найден или устарел")
    
    tokens = create_tokens(db_user)
    db_user.refresh_token = tokens["refresh_token"]
    db.commit()
    db.refresh(db_user)
    
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(db_user)
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.refresh_token = None
    db.commit()
    
    return {"message": "Успешный выход из системы"}

@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.put("/profile", response_model=UserResponse)
def update_profile(
    user_update: UserUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    update_data = user_update.model_dump(exclude_unset=True)
    
    if "first_name" in update_data:
        current_user.first_name = update_data["first_name"]
    
    if "last_name" in update_data:
        current_user.last_name = update_data["last_name"]
    
    if "email" in update_data:
        new_email = update_data["email"]
        if new_email != current_user.email:
            existing_user = db.query(User).filter(
                User.email == new_email,
                User.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Email уже используется")
            current_user.email = new_email
    
    if "password" in update_data:
        new_password = update_data["password"]
        if not validate_password_policy(new_password):
            raise HTTPException(
                status_code=400, 
                detail="Пароль должен содержать 6-14 символов, одну заглавную букву и одну цифру"
            )
        current_user.hashed_password = get_password_hash(new_password)
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.model_validate(current_user)

@router.delete("/profile")
def delete_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(current_user)
    db.commit()
    
    return {"message": "Пользователь успешно удален"}


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_role("admin"))
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.role = data.role
    db.commit()

    return {"message": f"Роль пользователя изменена на {data.role}"}

@router.get("/users", response_model=list[UserResponse])
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.delete("/users/{user_id}")
def delete_any_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    db.delete(user)
    db.commit()
    return {"message": "Пользователь успешно удален"}