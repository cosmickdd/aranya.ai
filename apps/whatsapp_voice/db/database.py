"""
db/database.py — Self-contained SQLite database for the WhatsApp+Voice service.
Shares the SAME .db file as the Telegram MVP so all channels have unified memory.
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import OperationalError

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String, unique=True, nullable=False, index=True)   # reused as phone_id
    first_name  = Column(String, nullable=True)
    language    = Column(String, default="hi")
    location    = Column(String, nullable=True)
    crops       = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    last_seen   = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    role      = Column(String, nullable=False)      # "user" or "model"
    content   = Column(Text, nullable=False)
    msg_type  = Column(String, default="text")       # "text", "voice", "photo"
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="messages")


# Point to the SAME db file the Telegram MVP uses (repo root)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "aranya_mvp.db"))
engine      = create_engine(f"sqlite:///{_REPO_ROOT}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as exc:
        msg = str(exc).lower()
        if "already exists" in msg:
            return
        raise


def get_session():
    return SessionLocal()
