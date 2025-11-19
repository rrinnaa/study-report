from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from .config import JWT_SECRET_KEY, JWT_ALGORITHM

class JWTMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, public_paths=None):
        super().__init__(app)
        self.public_paths = public_paths or []

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        if request.method == "OPTIONS" or any(path == p for p in self.public_paths):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Токен отсутствует"})

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            
            if payload.get("type") != "access":
                return JSONResponse(status_code=401, content={"detail": "Неверный тип токена"})
            
            request.state.user = {
                "user_id": payload.get("user_id"),
                "sub": payload.get("sub")
            }
            
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Токен истек"})
        except JWTError:
            return JSONResponse(status_code=401, content={"detail": "Невалидный токен"})

        return await call_next(request)