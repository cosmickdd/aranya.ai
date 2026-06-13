#!/bin/bash
# validate-deployment.sh — Pre-deployment validation script for Aranya.ai (Linux/macOS)

set -e

ENVIRONMENT="${1:-dev}"
HAS_ERRORS=false

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; HAS_ERRORS=true; }

echo -e "\n${CYAN}=== Aranya.ai Deployment Validation ===${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Check Python version
echo "Checking Python..."
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
if [[ $PYTHON_VERSION =~ ^3\.(11|12|13) ]]; then
    log_success "Python version: $PYTHON_VERSION"
else
    log_error "Python 3.11+ required, found: $PYTHON_VERSION"
fi

# Check required packages
echo ""
echo "Checking required packages..."
REQUIRED_PACKAGES=("flask" "twilio" "google-genai" "python-dotenv" "sqlalchemy" "gunicorn")
for package in "${REQUIRED_PACKAGES[@]}"; do
    if python3 -c "import ${package//-/_}" 2>/dev/null; then
        log_success "$package installed"
    else
        log_error "$package NOT installed"
    fi
done

# Check environment variables
echo ""
echo "Checking environment variables..."
REQUIRED_VARS=("TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN" "TWILIO_PHONE_NUMBER" "GEMINI_API_KEY" "PUBLIC_URL")
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        log_error "$var is NOT set"
    else
        log_success "$var is set"
    fi
done

# Check .env file
echo ""
echo "Checking .env file..."
if [[ -f "whatsapp_voice/.env" ]]; then
    log_success ".env file exists"
    VAR_COUNT=$(grep -c "^[A-Z_]" whatsapp_voice/.env || echo "0")
    log_success "  Found $VAR_COUNT variables configured"
else
    log_error ".env file NOT found — copy from .env.example"
fi

# Check database
echo ""
echo "Checking database..."
if [[ -f "aranya_mvp.db" ]]; then
    log_success "SQLite database exists"
else
    log_warning "Database will be created on first run"
fi

# Check Docker
echo ""
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    log_success "Docker is installed"
    if [[ -f "Dockerfile" ]]; then
        log_success "Dockerfile exists"
    else
        log_error "Dockerfile NOT found"
    fi
else
    log_warning "Docker not installed (OK for App Service with ZIP deploy)"
fi

# Check Azure tools
echo ""
echo "Checking Azure deployment tools..."
if command -v az &> /dev/null; then
    log_success "Azure CLI is installed"
else
    log_warning "Azure CLI not installed — needed for deployment"
fi

if command -v azd &> /dev/null; then
    log_success "Azure Developer CLI is installed"
else
    log_warning "Azure Developer CLI not installed — install from https://aka.ms/azd"
fi

# Check infrastructure files
echo ""
echo "Checking infrastructure files..."
if [[ -f "infra/main.bicep" ]]; then
    log_success "Bicep template exists"
else
    log_error "Bicep template NOT found"
fi

if [[ -f "azure.yaml" ]]; then
    log_success "azure.yaml configuration found"
else
    log_error "azure.yaml NOT found"
fi

# Final status
echo ""
if [[ "$HAS_ERRORS" == "true" ]]; then
    echo -e "${RED}=== VALIDATION FAILED ===${NC}"
    echo "Fix errors above before deploying."
    echo ""
    exit 1
else
    echo -e "${GREEN}=== VALIDATION PASSED ===${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Ensure all environment variables are set:"
    echo "     cd whatsapp_voice && cat .env"
    echo ""
    echo "  2. Run locally to test:"
    echo "     python server.py"
    echo ""
    echo "  3. Deploy to Azure:"
    echo "     azd up"
    echo ""
    echo "  4. Or use 'azd deploy' if infrastructure already exists"
    echo ""
    exit 0
fi
