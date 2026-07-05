# Deployment Guide — Aranya.ai WhatsApp + Voice Service

## Quick Start (Azure App Service)

### Prerequisites
- Azure subscription
- Azure CLI: `winget install Azure.CLI` (Windows) or `brew install azure-cli` (macOS/Linux)
- Azure Developer CLI: `choco install azd` (Windows) or `brew install azd` (macOS/Linux)

### Step 1: Prepare Environment

```powershell
# Windows
.\validate-deployment.ps1 -Environment dev

# macOS/Linux
bash validate-deployment.sh dev
```

### Step 2: Login to Azure

```bash
az login
azd auth login
```

### Step 3: Deploy with `azd up`

```bash
azd up
```

This will:
1. Create a resource group
2. Deploy infrastructure (Bicep templates)
3. Build Docker image
4. Push to Azure Container Registry
5. Deploy to App Service
6. Set environment variables from `.env`

### Step 4: Configure Twilio Webhooks

After deployment, get your App Service URL:

```bash
az webapp show -g <resource-group> -n <app-service-name> --query defaultHostName
```

Then update Twilio:
1. **WhatsApp**: Set `https://<app-url>/whatsapp`
2. **Voice (Inbound)**: Set `https://<app-url>/voice/incoming`
3. **Voice (Status)**: Set `https://<app-url>/voice/status`

### Step 5: Verify Deployment

```bash
# Check app logs
az webapp log tail -g <resource-group> -n <app-service-name>

# Test health endpoint
curl https://<app-url>/health
```

---

## Deployment Options

### Option A: ZIP Deploy (Simple, No Docker)

```bash
# Package code
Compress-Archive -Path whatsapp_voice\* -DestinationPath deploy.zip

# Deploy
az webapp deployment source config-zip -g <resource-group> -n <app-name> --src deploy.zip
```

### Option B: Docker (Container Apps or App Service)

```bash
# Build locally
docker build -t aranya-ai:latest .

# Tag for registry
docker tag aranya-ai:latest <registry>.azurecr.io/aranya-ai:latest

# Push to Azure Container Registry
docker push <registry>.azurecr.io/aranya-ai:latest

# Deploy with azd
azd up
```

### Option C: Direct Deployment (azd full automation)

```bash
azd up
# Azure handles all build, push, and deployment
```

---

## Environment Variables

Set these in Azure Key Vault or App Service Configuration:

```
TWILIO_ACCOUNT_SID       = ACxxxxxx...
TWILIO_AUTH_TOKEN        = xxxxxxxx...
TWILIO_WHATSAPP_NUMBER   = whatsapp:+14155238886
TWILIO_PHONE_NUMBER      = +1xxxxxxxxxx
GEMINI_API_KEY           = AIzaSy...
PUBLIC_URL               = https://your-app.azurewebsites.net
DATA_GOV_API_KEY         = (optional)
OPENWEATHER_API_KEY      = (optional)
```

### Set via Azure CLI

```bash
az webapp config appsettings set \
  -g <resource-group> \
  -n <app-service-name> \
  --settings TWILIO_ACCOUNT_SID="ACxxxxxx..." GEMINI_API_KEY="AIzaSy..."
```

### Set via Key Vault (recommended for production)

```bash
az keyvault secret set --vault-name <vault-name> --name TWILIO-ACCOUNT-SID --value "ACxxxxxx..."
az keyvault secret set --vault-name <vault-name> --name GEMINI-API-KEY --value "AIzaSy..."
```

---

## Monitoring & Debugging

### View Logs

```bash
# Real-time logs
az webapp log tail -g <resource-group> -n <app-service-name> --follow

# Download logs
az webapp log download -g <resource-group> -n <app-service-name>
```

### Check Application Insights

```bash
# Query telemetry
az monitor app-insights metrics show \
  -g <resource-group> \
  --app <app-insights-name> \
  -m "requests/count"
```

### Test Endpoints

```bash
# Health check
curl https://<app-url>/health

# Test outbound call (from Python)
curl -X POST https://<app-url>/test-call \
  -H "Content-Type: application/json" \
  -d '{"to": "+919876543210", "message": "Test message"}'
```

---

## Scaling & Performance

### Auto-Scaling (Production)

```bash
# Enable auto-scale
az appservice plan update \
  -g <resource-group> \
  --name <plan-name> \
  --number-of-workers 2
```

### Database Persistence

Audio cache and SQLite database are stored in:
- **Local**: `./whatsapp_voice/audio_cache/` + `aranya_mvp.db`
- **Azure**: Configure Azure Storage for shared audio cache

---

## Cost Estimation

| Component       | Tier        | Monthly Cost |
|-----------------|-------------|--------------|
| App Service     | B2 (1 core) | ~$50        |
| Storage         | Standard LRS | ~$2         |
| Application Insights | 1GB data | ~$5-10      |
| Twilio          | Pay-as-you-go | Variable   |
| **Total**       | -           | **~$60+**   |

Reduce costs:
- Use **B1** tier for dev/staging (~$15/month)
- Disable Application Insights for dev (~-$10/month)
- Use **Standard_LRS** (cheaper than GRS)

---

## Troubleshooting

### Port Binding Error
```
Address already in use (Errno 48)
```
Solution: Azure App Service uses port 8000; ensure Gunicorn config matches.

### Missing Environment Variables
```
KeyError: TWILIO_ACCOUNT_SID
```
Solution: Set variables in App Service → Configuration → Application settings

### Twilio Webhook Timeouts
```
504 Gateway Timeout
```
Solution: Ensure app is running. Check logs with `az webapp log tail`

### Database Lock
```
database is locked
```
Solution: SQLite is single-writer. Consider migrating to PostgreSQL for production.

---

## Production Checklist

- [ ] Environment variables set in Key Vault
- [ ] HTTPS enforced (set `HTTPS_ONLY=true`)
- [ ] Database backed up regularly
- [ ] Monitoring enabled (Application Insights)
- [ ] Log retention configured
- [ ] Auto-scaling enabled for traffic spikes
- [ ] Error alerts configured
- [ ] Twilio webhooks pointing to production URL
- [ ] Rate limiting configured (if needed)
- [ ] Security headers validated

---

## Rollback

If deployment fails, quickly rollback:

```bash
# Swap production and staging slots
az webapp deployment slot swap \
  -g <resource-group> \
  -n <app-service-name> \
  --slot staging

# Or redeploy previous version
azd deploy
```

---

## Support

- Azure Docs: https://learn.microsoft.com/azure/
- Twilio Docs: https://www.twilio.com/docs
- Flask Deployment: https://flask.palletsprojects.com/en/latest/deploying/
