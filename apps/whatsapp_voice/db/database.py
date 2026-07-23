"""
db/database.py — Database layer for Aranya.ai.

Supports two backends:
  • SQLite  (default/dev) — shared with the Telegram MVP via a single .db file
  • PostgreSQL (prod)     — set DATABASE_URL=postgresql://user:pass@host/db

No callers need to change: `get_session()` and all ORM models stay the same.
The only requirement for PostgreSQL is `psycopg2-binary` in requirements.txt.
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import OperationalError

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String, unique=True, nullable=False, index=True)   # reused as phone_id / firebase uid
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


# ── Engine selection ──────────────────────────────────────────────────────────
def _build_engine():
    database_url = os.getenv("DATABASE_URL", "")

    if database_url:
        # Production: PostgreSQL (or any SQLAlchemy-compatible URL).
        # Heroku/Render prefix "postgres://" → SQLAlchemy needs "postgresql://".
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return create_engine(
            database_url,
            pool_pre_ping=True,   # avoids stale connection errors on Postgres
            pool_size=5,
            max_overflow=10,
        )
    else:
        # Development / single-process: shared SQLite file.
        # Placed at repo root so both whatsapp_voice and mvp use the same file.
        repo_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data")
        )
        os.makedirs(repo_root, exist_ok=True)
        sqlite_path = os.path.join(repo_root, "aranya_mvp.db")
        return create_engine(
            f"sqlite:///{sqlite_path}",
            connect_args={"check_same_thread": False},
        )


engine       = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables if they don't already exist and ensure columns match model schema."""
    try:
        Base.metadata.create_all(bind=engine)
        
        # Self-healing migration for existing databases (adds missing User fields)
        columns_to_check = {
            "first_name": "VARCHAR",
            "language": "VARCHAR DEFAULT 'hi'",
            "location": "VARCHAR",
            "crops": "VARCHAR"
        }
        
        with engine.connect() as conn:
            for col_name, col_type in columns_to_check.items():
                try:
                    # Test if column exists by attempting to select it
                    conn.execute(text(f"SELECT {col_name} FROM users LIMIT 1"))
                except Exception:
                    # Column is missing, add it
                    try:
                        conn.rollback()  # Clear transaction error state
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass
    except OperationalError as exc:
        msg = str(exc).lower()
        if "already exists" in msg:
            return
        raise


def get_session():
    """Return a new SQLAlchemy session. Caller is responsible for closing it."""
    return SessionLocal()


def ping_db() -> bool:
    """
    Health-check helper: attempts a lightweight query.
    Returns True if the DB is reachable, False otherwise.
    Used by the /health endpoint.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
