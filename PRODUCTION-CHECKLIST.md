# Production Deployment Checklist — Aranya.ai

## Pre-Deployment

- [ ] All unit tests passing
- [ ] Code reviewed and merged to main branch
- [ ] Security scan completed (secrets, dependencies)
- [ ] `.env` file NOT committed to git
- [ ] `.gitignore` updated with sensitive files
- [ ] Database migrations tested in staging
- [ ] Dependencies frozen in `requirements.txt`

## Environment Configuration

- [ ] All required env vars defined in `.env.example`
- [ ] No hardcoded credentials in source code
- [ ] Secrets stored in Azure Key Vault (production)
- [ ] Environment variables validated at startup
- [ ] Database connection string uses Azure SQL or managed service

## Docker & Containerization

- [ ] Dockerfile builds successfully locally
- [ ] `docker-compose.yml` works for local testing
- [ ] Image tagged with semantic version (e.g., `v1.0.0`)
- [ ] Multi-stage build reduces final image size
- [ ] Health check endpoint configured (`/health`)
- [ ] No sensitive data in image layers

## Infrastructure as Code

- [ ] Bicep templates reviewed and valid
  ```bash
  az bicep build -f infra/main.bicep
  ```
- [ ] `azure.yaml` correctly configured
- [ ] Resource naming follows Azure conventions
- [ ] RBAC roles assigned with least privilege
- [ ] Network security groups configured
- [ ] Private endpoints configured (if applicable)

## Application Security

- [ ] Security headers set in `wsgi_production.py`:
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Strict-Transport-Security enabled
  - [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] SQL injection protection (using SQLAlchemy ORM)
- [ ] Rate limiting configured (if needed)
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive info

## Monitoring & Logging

- [ ] Application Insights enabled
- [ ] Custom metrics configured:
  - [ ] Request count per endpoint
  - [ ] Response times
  - [ ] Error rates
  - [ ] Twilio API call success rate
- [ ] Log retention policy set (30+ days)
- [ ] Log level set to INFO (not DEBUG) in production
- [ ] Alerts configured for errors and timeouts
- [ ] Diagnostic logs enabled on App Service

## Database & Data

- [ ] SQLite migration path planned (or Azure SQL configured)
- [ ] Database backups automated
- [ ] Data retention policy documented
- [ ] Migration scripts tested
- [ ] Database indexes optimized
- [ ] Connection pooling configured

## Deployment Process

- [ ] Deployment script (validation-deployment.ps1/sh) runs without errors
- [ ] `azd up` tested in staging environment
- [ ] Rollback strategy documented
- [ ] Deployment takes < 10 minutes
- [ ] Zero-downtime deployment strategy (if using slots)
- [ ] Automated tests run on each deployment

## Performance & Scaling

- [ ] App Service tier chosen for expected load (B2 minimum for production)
- [ ] Auto-scaling rules configured:
  - [ ] Scale up: CPU > 70% or Memory > 80%
  - [ ] Scale down: CPU < 40% for 10 minutes
  - [ ] Min instances: 2 (for availability)
  - [ ] Max instances: 5-10 (adjust per load testing)
- [ ] Gunicorn workers: 4 per CPU core
- [ ] Request timeout: 60 seconds (adjust per needs)
- [ ] Connection pooling: enabled

## Twilio Integration

- [ ] Twilio credentials stored in Key Vault (not in code)
- [ ] Webhook URLs updated to production domain
- [ ] Webhook authentication validated (if configured)
- [ ] Error handling for Twilio API failures
- [ ] Fallback mechanisms for TTS/speech-to-text
- [ ] Retry logic with exponential backoff
- [ ] Rate limiting from Twilio documented

## Disaster Recovery

- [ ] Backup strategy documented (daily snapshots)
- [ ] Restore procedure tested
- [ ] RTO (Recovery Time Objective): < 1 hour
- [ ] RPO (Recovery Point Objective): < 15 minutes
- [ ] Failover tested (if multi-region)
- [ ] Data loss risk minimized

## Documentation

- [ ] README.md updated with production setup
- [ ] DEPLOYMENT.md includes:
  - [ ] Prerequisites
  - [ ] Step-by-step deployment
  - [ ] Troubleshooting guide
  - [ ] Rollback instructions
- [ ] Architecture diagram documented
- [ ] Environment variable reference documented
- [ ] API endpoints documented
- [ ] Known issues documented

## Post-Deployment Testing

- [ ] Health check endpoint returns 200 OK
- [ ] WhatsApp webhook receives and processes messages
- [ ] Voice call routing works end-to-end
- [ ] TTS audio generated and served correctly
- [ ] Database queries execute within SLA
- [ ] Logs appear in Application Insights
- [ ] Alerts trigger on test errors
- [ ] Load test simulates expected traffic

## Compliance & Security Review

- [ ] Data privacy policy compliant
- [ ] GDPR compliance (if EU users)
- [ ] PII handling documented
- [ ] Encryption in transit (HTTPS) enforced
- [ ] Encryption at rest (storage, database)
- [ ] Access logs retention configured
- [ ] Security scanning enabled (Dependabot, etc.)
- [ ] Vulnerability assessment completed

## Sign-Off

- [ ] Deployment approved by team lead
- [ ] Operations/DevOps team trained
- [ ] On-call runbook prepared
- [ ] Incident response plan documented
- [ ] Cost estimate reviewed and approved
- [ ] Go-live scheduled and communicated

---

## Quick Commands

```bash
# Validate environment
./validate-deployment.ps1 -Environment prod

# Build Docker image
docker build -t aranya-ai:v1.0.0 .

# Deploy to Azure
azd up

# View logs
az webapp log tail -g <resource-group> -n <app-name> --follow

# Run monitoring query
az monitor app-insights query \
  --app <app-insights-name> \
  -g <resource-group> \
  --analytics-query "requests | summarize Count=sum(itemCount) by name"
```

## Rollback Plan

If issues occur post-deployment:

```bash
# Option 1: Swap slots (if using staging)
az webapp deployment slot swap \
  -g <resource-group> \
  -n <app-name> \
  --slot staging

# Option 2: Redeploy previous version
git checkout previous-tag
azd deploy

# Option 3: Scale down and investigate
az appservice plan update \
  -g <resource-group> \
  --name <plan-name> \
  --number-of-workers 0
```
