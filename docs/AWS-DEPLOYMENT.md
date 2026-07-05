# AWS Deployment Guide — Aranya.ai WhatsApp + Voice Service

## Option 1: EC2 (Simple, Self-managed)

### Prerequisites
- AWS account with EC2 and VPC access
- AWS CLI configured: `aws configure`
- SSH key pair created in AWS

### Step 1: Create Stack

```bash
# Upload CloudFormation template
aws cloudformation create-stack \
  --stack-name aranya-dev \
  --template-body file://infra/cloudformation.yaml \
  --parameters \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=KeyPairName,ParameterValue=your-key-pair \
    ParameterKey=Environment,ParameterValue=dev \
  --region us-east-1
```

### Step 2: Wait for Stack Creation

```bash
aws cloudformation wait stack-create-complete \
  --stack-name aranya-dev \
  --region us-east-1

# Get instance IP
aws cloudformation describe-stacks \
  --stack-name aranya-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`InstancePublicIP`].OutputValue' \
  --output text
```

### Step 3: SSH into Instance

```bash
# Fix key permissions
chmod 600 ~/downloads/aranya-key.pem

# SSH in
ssh -i ~/downloads/aranya-key.pem ubuntu@<IP_ADDRESS>
```

### Step 4: Deploy Application

```bash
# On the EC2 instance
cd /opt/aranya

# Clone your repository
git clone https://github.com/your-org/aranya.ai.git .

# Setup Python environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r whatsapp_voice/requirements.txt

# Create .env from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id aranya/env \
  --query SecretString \
  --output text > whatsapp_voice/.env

# Start application via Supervisor
sudo systemctl restart supervisor
sudo supervisorctl start aranya
```

### Step 5: Configure Twilio Webhooks

Set in Twilio Console:
- **WhatsApp**: `https://<instance-ip>/whatsapp`
- **Voice Incoming**: `https://<instance-ip>/voice/incoming`
- **Voice Status**: `https://<instance-ip>/voice/status`

### Step 6: Monitor

```bash
# View application logs
sudo tail -f /var/log/aranya/gunicorn-access.log
sudo tail -f /var/log/aranya/gunicorn-error.log

# SSH into instance and check
sudo supervisorctl status aranya
```

---

## Option 2: ECS Fargate (Serverless, Managed)

### Prerequisites
- Docker image pushed to ECR
- AWS Secrets Manager configured with credentials
- VPC and subnets already created

### Step 1: Push Docker Image to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name aranya --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t aranya:latest .
docker tag aranya:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/aranya:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/aranya:latest
```

### Step 2: Create Secrets in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name aranya/twilio/account-sid \
  --secret-string "ACxxxxxxxx..." \
  --region us-east-1

aws secretsmanager create-secret \
  --name aranya/twilio/auth-token \
  --secret-string "your-token..." \
  --region us-east-1

aws secretsmanager create-secret \
  --name aranya/gemini/api-key \
  --secret-string "AIzaSy..." \
  --region us-east-1
```

### Step 3: Create ECS Stack

```bash
# Export VPC info first (or update template)
export VPC_SUBNETS="subnet-xxxxx,subnet-yyyyy"
export VPC_ID="vpc-xxxxx"

# Create stack
aws cloudformation create-stack \
  --stack-name aranya-fargate-dev \
  --template-body file://infra/ecs-fargate.yaml \
  --parameters \
    ParameterKey=ContainerImage,ParameterValue=123456789.dkr.ecr.us-east-1.amazonaws.com/aranya:latest \
    ParameterKey=DesiredCount,ParameterValue=1 \
    ParameterKey=Environment,ParameterValue=dev \
  --region us-east-1
```

### Step 4: Get Service URL

```bash
aws cloudformation describe-stacks \
  --stack-name aranya-fargate-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceURL`].OutputValue' \
  --output text
```

### Step 5: Update Twilio Webhooks

```bash
SERVICE_URL=$(aws cloudformation describe-stacks \
  --stack-name aranya-fargate-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceURL`].OutputValue' \
  --output text)

# Update Twilio (manual or via Twilio API)
echo "Set Twilio webhooks to: https://$SERVICE_URL"
```

---

## Option 3: Elastic Beanstalk (PaaS)

### Prerequisites
- AWS Elastic Beanstalk CLI: `pip install awsebcli`

### Step 1: Initialize Beanstalk

```bash
eb init -p python-3.11 aranya --region us-east-1
```

### Step 2: Create Environment

```bash
eb create aranya-dev \
  --instance-type t3.medium \
  --envvars ENVIRONMENT=dev,PORT=8000
```

### Step 3: Deploy

```bash
git push
eb deploy
```

---

## Troubleshooting SSH Connection Timeout

### Issue: `ssh: connect to host 16.170.163.3 port 22: Connection timed out`

**Causes:**
1. Security group doesn't allow SSH (port 22)
2. Instance not running
3. Public IP not assigned
4. Network ACL blocking traffic
5. IP changed (EC2 restarted)

### Solutions

```bash
# 1. Check if instance is running
aws ec2 describe-instances \
  --instance-ids i-0123456789abcdef0 \
  --query 'Reservations[0].Instances[0].State.Name'

# 2. Check security group allows SSH
aws ec2 describe-security-groups \
  --group-ids sg-0123456789abcdef0 \
  --query 'SecurityGroups[0].IpPermissions'

# 3. Check public IP assigned
aws ec2 describe-instances \
  --instance-ids i-0123456789abcdef0 \
  --query 'Reservations[0].Instances[0].PublicIpAddress'

# 4. Add SSH rule to security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# 5. Wait 1-2 minutes and retry SSH
sleep 60
ssh -i ~/downloads/aranya-key.pem ubuntu@<NEW_IP>
```

---

## Scaling & Auto-Scaling

### EC2 Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name aranya-asg \
  --launch-template LaunchTemplateName=aranya,Version=1 \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 2 \
  --region us-east-1
```

### ECS Service Auto Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/aranya-dev/aranya-service-dev \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 5 \
  --region us-east-1

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name aranya-cpu-scaling \
  --service-namespace ecs \
  --resource-id service/aranya-dev/aranya-service-dev \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    TargetValue=70.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization} \
  --region us-east-1
```

---

## Cost Estimation

| Option      | Compute       | Monthly Cost | Notes                   |
|-------------|---------------|--------------|------------------------|
| EC2 t3.micro| $0.0104/hr    | ~$7.50       | Free tier eligible      |
| EC2 t3.medium | $0.0416/hr  | ~$30         | Recommended min        |
| Fargate     | $0.04288/hr   | ~$30         | Per vCPU + memory      |
| Beanstalk   | Same as EC2   | Variable     | Managed overhead        |

---

## Cost Optimization

1. **Use t3.micro for dev/test** (~$7/month)
2. **Enable auto-scaling** to reduce idle instances
3. **Use Fargate Spot** (~70% discount) for non-critical workloads
4. **Set RDS to single-AZ** for dev environments
5. **Use Reserved Instances** (1-3 year commitment) for production

---

## Monitoring with CloudWatch

```bash
# View application logs
aws logs tail /ecs/aranya-dev --follow

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name aranya \
  --dashboard-body file://monitoring-dashboard.json
```

---

## Deployment Checklist

- [ ] AWS account created and configured
- [ ] AWS CLI installed and configured
- [ ] Docker image built and tested locally
- [ ] Secrets stored in Secrets Manager
- [ ] VPC and subnets configured
- [ ] Security groups allow necessary ports
- [ ] CloudFormation template tested
- [ ] Environment variables validated
- [ ] Monitoring/CloudWatch configured
- [ ] Backups enabled
- [ ] SSL/TLS certificates ready
- [ ] Twilio webhooks updated

---

## Quick Commands

```bash
# Get instance details
aws ec2 describe-instances --region us-east-1 --query 'Reservations[0].Instances[0]'

# Monitor logs
aws logs tail /ecs/aranya-dev --follow

# Scale ECS service
aws ecs update-service --cluster aranya-dev --service aranya-service-dev --desired-count 3

# Restart EC2 instance
aws ec2 reboot-instances --instance-ids i-0123456789abcdef0

# Check deployment status
aws cloudformation describe-stacks --stack-name aranya-dev
```
