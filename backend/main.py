from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from .auth import router as auth_router
from .analyze import router as analyze_router
from .jwt_middleware import JWTMiddleware 

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Report Analyzer API")

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

app.add_middleware(
    JWTMiddleware,
    public_paths=[
        "/api/login",
        "/api/register",
        "/api/health",
    ]
)

app.include_router(auth_router)
app.include_router(analyze_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}