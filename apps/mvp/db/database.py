import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=True)
    language = Column(String, default="hi")   # hi = Hindi, en = English
    location = Column(String, nullable=True)  # e.g. "Varanasi, UP"
    crops = Column(String, nullable=True)     # e.g. "Wheat, Rice"
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)    # "user" or "model"
    content = Column(Text, nullable=False)
    msg_type = Column(String, default="text")  # "text", "voice", "photo"
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="messages")


# Database file lives in the repo root
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_BASE_DIR, "aranya_mvp.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_session():
    """Return a new database session."""
    return SessionLocal()
