from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import User, get_db
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    payload = getattr(request.state, 'user', None)
    if not payload:
        raise HTTPException(status_code=401, detail="Не авторизован")
    
    user_email = payload.get("sub")
    db_user = db.query(User).filter(User.email == user_email).first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return db_user