from fastapi import FastAPI
from fastapi import HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
import logging
from .auth import router as auth_router
from .analyze import router as analyze_router
from .jwt_middleware import JWTMiddleware
from .database import run_migrations
from .config import ENABLE_DOCS, CORS_ALLOW_ORIGINS, SITE_URL
from .external_api_service import external_study_tip_service

logging.basicConfig(level=logging.INFO)
app = FastAPI(
    title="Report Analyzer API",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

@app.on_event("startup")
def on_startup():
    run_migrations()

app.add_middleware(
    JWTMiddleware,
    public_paths=[
        "/",
        "/robots.txt",
        "/sitemap.xml",
        "/api/login",
        "/api/register",
        "/api/health",
        "/api/refresh",
        "/api/external/study-tip",
        "/api/legacy/analyze",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots_txt():
    return "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /auth",
        "Disallow: /reports/",
        "Disallow: /admin/",
        "Disallow: /profile/",
        f"Sitemap: {SITE_URL}/sitemap.xml",
    ])


@app.get("/sitemap.xml")
def sitemap_xml():
    sitemap = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">
  <url>
    <loc>{home}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
""".format(home=f"{SITE_URL}/")
    return Response(content=sitemap, media_type="application/xml")


@app.get("/api/external/study-tip")
async def get_study_tip(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    return await external_study_tip_service.get_study_tip(client_ip)


@app.get("/api/legacy/analyze")
def removed_legacy_endpoint():
    raise HTTPException(status_code=410, detail="Эндпоинт удален. Используйте /api/analyze")