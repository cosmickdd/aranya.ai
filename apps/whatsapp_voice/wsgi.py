"""
wsgi.py — Production WSGI entry point for Aranya.ai service.
Used by Gunicorn/Waitress on Azure App Service.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Initialize database
from db.database import init_db
init_db()

# Import Flask app
from server import app

if __name__ == "__main__":
    app.run()
