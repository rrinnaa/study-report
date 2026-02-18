from sqlalchemy import create_engine, Column, Integer, String, JSON, ForeignKey, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime
from .config import DATABASE_URL
from sqlalchemy.dialects.postgresql import JSONB

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
    analyses = relationship("Analysis", back_populates="user")
    refresh_token = Column(String, nullable=True)
    role = Column(String(20), default="user")

class Analysis(Base):
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String, nullable=False)
    score = Column(Integer, default=0)
    user = relationship("User", back_populates="analyses")
    full_result = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()