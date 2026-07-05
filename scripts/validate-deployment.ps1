#!/usr/bin/env pwsh
# validate-deployment.ps1 — Pre-deployment validation script for Aranya.ai
# Validates environment, dependencies, and configuration before deploying to Azure

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$Strict = $false
)

$ErrorActionPreference = "Stop"
$script:hasErrors = $false

function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red; $script:hasErrors = $true }

Write-Host "`n=== Aranya.ai Deployment Validation ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment`n"

# Check Python version
Write-Host "Checking Python..." -NoNewline
$pythonVersion = python --version 2>&1
if ($pythonVersion -match "3\.(11|12|13)") {
    Write-Success "Python version: $pythonVersion"
} else {
    Write-Error "Python 3.11+ required, found: $pythonVersion"
}

# Check pip packages
Write-Host "`nChecking required packages..."
$requiredPackages = @(
    "flask",
    "twilio",
    "google-genai",
    "python-dotenv",
    "sqlalchemy",
    "gunicorn"
)

foreach ($package in $requiredPackages) {
    pip show $package >$null 2>&1
    if ($?) {
        Write-Success "$package installed"
    } else {
        Write-Error "$package NOT installed"
    }
}

# Check environment variables
Write-Host "`nChecking environment variables..."
$requiredEnvVars = @(
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "GEMINI_API_KEY",
    "PUBLIC_URL"
)

foreach ($var in $requiredEnvVars) {
    if ([Environment]::GetEnvironmentVariable($var)) {
        Write-Success "$var is set"
    } else {
        Write-Error "$var is NOT set"
    }
}

# Check .env file
Write-Host "`nChecking .env file..."
if (Test-Path "whatsapp_voice\.env") {
    Write-Success ".env file exists"
    $envContent = Get-Content "whatsapp_voice\.env" | Where-Object { $_ -match "^[A-Z_]+" }
    Write-Success "  Found $(($envContent | Measure-Object).Count) variables configured"
} else {
    Write-Error ".env file NOT found — copy from .env.example"
}

# Check database
Write-Host "`nChecking database..."
if (Test-Path "aranya_mvp.db") {
    Write-Success "SQLite database exists"
} else {
    Write-Warning "Database will be created on first run"
}

# Check Docker (if deploying as container)
Write-Host "`nChecking Docker..."
docker --version >$null 2>&1
if ($?) {
    Write-Success "Docker is installed"
    
    # Validate Dockerfile
    if (Test-Path "Dockerfile") {
        Write-Success "Dockerfile exists"
    } else {
        Write-Error "Dockerfile NOT found"
    }
} else {
    Write-Warning "Docker not installed (OK for App Service with ZIP deploy)"
}

# Check Azure CLI
Write-Host "`nChecking Azure deployment tools..."
az --version >$null 2>&1
if ($?) {
    Write-Success "Azure CLI is installed"
} else {
    Write-Warning "Azure CLI not installed — needed for 'azd up' deployment"
}

azd --version >$null 2>&1
if ($?) {
    Write-Success "Azure Developer CLI is installed"
} else {
    Write-Warning "Azure Developer CLI not installed — install from https://aka.ms/azd"
}

# Check infrastructure files
Write-Host "`nChecking infrastructure files..."
if (Test-Path "infra\main.bicep") {
    Write-Success "Bicep template exists (infra/main.bicep)"
} else {
    Write-Error "Bicep template NOT found — needed for 'azd up' deployment"
}

if (Test-Path "azure.yaml") {
    Write-Success "azure.yaml configuration found"
} else {
    Write-Error "azure.yaml NOT found"
}

# Final status
Write-Host "`n" 
if ($script:hasErrors) {
    Write-Host "=== VALIDATION FAILED ===" -ForegroundColor Red
    Write-Host "Fix errors above before deploying.`n"
    exit 1
} else {
    Write-Host "=== VALIDATION PASSED ===" -ForegroundColor Green
    Write-Host "`nNext steps:`n"
    Write-Host "  1. Ensure all environment variables are set:"
    Write-Host "     cd whatsapp_voice && cat .env`n"
    Write-Host "  2. Run locally to test:"
    Write-Host "     python server.py`n"
    Write-Host "  3. Deploy to Azure (requires 'azd' and 'bicep'):"
    Write-Host "     azd up`n"
    Write-Host "  4. Or use 'azd deploy' if infrastructure already exists`n"
    exit 0
}
