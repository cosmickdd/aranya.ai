#!/bin/bash
# troubleshoot-aws-connection.sh - Diagnose AWS EC2 connectivity issues

INSTANCE_IP="${1:-16.170.163.3}"
REGION="${2:-us-east-1}"
KEY_PATH="${3:-$HOME/downloads/aranya-key.pem}"

echo ""
echo "=== AWS EC2 Connection Troubleshooter ==="
echo "Instance IP: $INSTANCE_IP"
echo "Region: $REGION"
echo ""

# Check AWS CLI
echo -n "Checking AWS CLI... "
if command -v aws &> /dev/null; then
    echo "OK"
else
    echo "NOT FOUND"
    exit 1
fi

# Test credentials
echo -n "Testing AWS credentials... "
if ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>&1); then
    echo "OK (Account: $ACCOUNT)"
else
    echo "FAILED - run 'aws configure'"
    exit 1
fi

# Find instance
echo ""
echo "Searching for instance with IP $INSTANCE_IP..."
INSTANCE_ID=$(aws ec2 describe-instances \
    --region $REGION \
    --filters "Name=instance-state-name,Values=running" \
    --query "Reservations[].Instances[?PublicIpAddress=='$INSTANCE_IP'].InstanceId" \
    --output text 2>/dev/null)

if [ -z "$INSTANCE_ID" ]; then
    echo "ERROR: No running instance found with IP $INSTANCE_IP"
    exit 1
fi

echo "Found instance: $INSTANCE_ID"

# Get instance details
echo ""
echo "=== Instance Details ==="
aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].[State.Name,InstanceType,PublicIpAddress,PrivateIpAddress]' \
    --output text | while read state type pubip privip; do
    echo "State: $state"
    echo "Type: $type"
    echo "Public IP: $pubip"
    echo "Private IP: $privip"
done

# Check security groups
echo ""
echo "=== Security Group Analysis ==="
aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId' \
    --output text | while read sg; do
    echo "Checking $sg..."
    
    SSH_RULE=$(aws ec2 describe-security-groups \
        --group-ids $sg \
        --region $REGION \
        --query "SecurityGroups[0].IpPermissions[?FromPort==22].FromPort" \
        --output text 2>/dev/null)
    
    if [ -n "$SSH_RULE" ]; then
        echo "  SSH (port 22) is OPEN"
    else
        echo "  ERROR: SSH (port 22) is NOT open"
    fi
done

# Check SSH key
echo ""
echo "=== SSH Key Verification ==="
if [ -f "$KEY_PATH" ]; then
    echo "SSH key found: $KEY_PATH"
    chmod 600 "$KEY_PATH"
    echo "Key permissions set to 600"
else
    echo "ERROR: SSH key not found at $KEY_PATH"
    exit 1
fi

# Test connection
echo ""
echo "=== Connection Test ==="
echo "Testing SSH connectivity to $INSTANCE_IP on port 22..."
timeout 5 bash -c "</dev/tcp/$INSTANCE_IP/22" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "OK: Port 22 is OPEN"
    echo ""
    echo "You can now SSH into the instance:"
    echo "  ssh -i '$KEY_PATH' ubuntu@$INSTANCE_IP"
else
    echo "ERROR: Port 22 is CLOSED or not responding"
    echo ""
    echo "Try these fixes:"
    echo "1. aws ec2 start-instances --instance-ids $INSTANCE_ID --region $REGION"
    echo "2. Wait 1-2 minutes for network initialization"
    echo "3. Check security group allows port 22"
    echo "4. Retry in 2 minutes"
fi

echo ""
