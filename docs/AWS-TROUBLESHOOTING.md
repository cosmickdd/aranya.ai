# Quick AWS Connection Troubleshooting Commands

## For Your Instance: 16.170.163.3

### 1. Check if Instance is Running

```powershell
aws ec2 describe-instances --region us-east-1 --query 'Reservations[0].Instances[0].State.Name' --output text
```

Expected output: `running`

If showing `stopped`, start it:
```powershell
aws ec2 start-instances --instance-ids i-xxxxx --region us-east-1
# Then wait 2-3 minutes
```

### 2. Check Security Group Allows SSH (Port 22)

```powershell
aws ec2 describe-security-groups --region us-east-1 --query 'SecurityGroups[0].IpPermissions[?FromPort==22]' --output table
```

If no output, add SSH rule:
```powershell
aws ec2 authorize-security-group-ingress --group-id sg-xxxxx --protocol tcp --port 22 --cidr 0.0.0.0/0 --region us-east-1
```

### 3. Verify Public IP is Assigned

```powershell
aws ec2 describe-instances --instance-ids i-xxxxx --region us-east-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```

Expected output: `16.170.163.3`

If blank, allocate Elastic IP:
```powershell
aws ec2 allocate-address --domain vpc --region us-east-1
aws ec2 associate-address --instance-id i-xxxxx --allocation-id eipalloc-xxxxx --region us-east-1
```

### 4. Fix Key Permissions

```powershell
icacls "C:\Users\ASUS\downloads\aranya-key.pem" /grant:r "$($env:USERNAME):F"
icacls "C:\Users\ASUS\downloads\aranya-key.pem" /inheritance:r
```

### 5. Test SSH Connection

```powershell
ssh -i "C:\Users\ASUS\downloads\aranya-key.pem" ubuntu@16.170.163.3
```

### 6. If SSH Still Times Out (Connection Refused)

Option A: Use Session Manager (no SSH required):
```powershell
aws ssm start-session --target i-xxxxx --region us-east-1
```

Option B: Terminate and recreate instance:
```powershell
aws ec2 terminate-instances --instance-ids i-xxxxx --region us-east-1
aws cloudformation create-stack --stack-name aranya-new --template-body file://infra/cloudformation.yaml --parameters ParameterKey=KeyPairName,ParameterValue=aranya-key --region us-east-1
```

### 7. Reboot Instance

```powershell
aws ec2 reboot-instances --instance-ids i-xxxxx --region us-east-1
# Wait 2 minutes then try SSH again
```

---

## Quick Test: Detailed Instance Info

```powershell
aws ec2 describe-instances --region us-east-1 --query 'Reservations[0].Instances[0].[InstanceId,State.Name,InstanceType,PublicIpAddress,PrivateIpAddress,SecurityGroups[0].GroupId]' --output table
```

---

## Common Issues & Fixes

| Issue | Command to Fix |
|-------|---|
| Instance stopped | `aws ec2 start-instances --instance-ids i-xxxxx --region us-east-1` |
| No public IP | `aws ec2 allocate-address --domain vpc --region us-east-1` |
| SSH port blocked | `aws ec2 authorize-security-group-ingress --group-id sg-xxxxx --protocol tcp --port 22 --cidr 0.0.0.0/0` |
| Connection timeout | Wait 2 minutes, then reboot: `aws ec2 reboot-instances --instance-ids i-xxxxx --region us-east-1` |
| Key permission denied | Fix file permissions (see step 4 above) |

---

## Deploy New Instance from CloudFormation

```powershell
aws cloudformation create-stack `
  --stack-name aranya-dev `
  --template-body file://infra/cloudformation.yaml `
  --parameters `
    ParameterKey=InstanceType,ParameterValue=t3.medium `
    ParameterKey=KeyPairName,ParameterValue=aranya-key `
    ParameterKey=Environment,ParameterValue=dev `
  --region us-east-1

# Wait for creation (5-10 minutes)
aws cloudformation wait stack-create-complete --stack-name aranya-dev --region us-east-1

# Get the new instance IP
aws cloudformation describe-stacks --stack-name aranya-dev --query 'Stacks[0].Outputs[?OutputKey==`InstancePublicIP`].OutputValue' --output text --region us-east-1
```

---

## Deploy Application on EC2

Once SSH is working:

```bash
# SSH into instance
ssh -i "C:\Users\ASUS\downloads\aranya-key.pem" ubuntu@16.170.163.3

# Then on the instance:
cd /opt/aranya

# Clone repo
git clone https://github.com/your-org/aranya.ai.git .

# Setup Python
python3.11 -m venv venv
source venv/bin/activate
pip install -r whatsapp_voice/requirements.txt

# Set environment variables
aws secretsmanager get-secret-value --secret-id aranya/env --query SecretString --output text > whatsapp_voice/.env

# Start service
sudo systemctl restart supervisor
sudo supervisorctl start aranya

# Check logs
sudo tail -f /var/log/aranya/gunicorn-access.log
```
