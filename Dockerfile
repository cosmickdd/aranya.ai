# Multi-stage Dockerfile for Aranya.ai WhatsApp+Voice service

# Build stage
FROM python:3.11-slim as builder

WORKDIR /tmp/build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from both projects
COPY requirements.txt ./
COPY whatsapp_voice/requirements.txt ./whatsapp_voice_requirements.txt

# Create virtual environment
RUN python -m venv /opt/venv

# Activate venv and install dependencies
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt && \
    pip install -r whatsapp_voice_requirements.txt && \
    pip install gunicorn==21.2.0

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY whatsapp_voice/ /app/whatsapp_voice/
COPY docs/ /app/docs/

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app/whatsapp_voice

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 8000

# Run Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
