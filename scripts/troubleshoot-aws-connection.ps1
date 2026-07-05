#!/usr/bin/env pwsh
# troubleshoot-aws-connection.ps1 — Diagnose AWS EC2 connectivity issues

param(
    [Parameter(Mandatory=$false)]
    [string]$InstanceId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$InstanceIP = "16.170.163.3",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1",
    
    [Parameter(Mandatory=$false)]
    [string]$KeyPath = "$HOME\downloads\aranya-key.pem"
)

$ErrorActionPreference = "Continue"
$script:hasErrors = $false

function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red; $script:hasErrors = $true }

Write-Host "`n=== AWS EC2 Connection Troubleshooter ===" -ForegroundColor Cyan
Write-Host "Instance IP: $InstanceIP"
Write-Host "Region: $Region`n"

# Check AWS CLI
Write-Host "Checking AWS CLI..." -NoNewline
try {
    aws --version > $null 2>&1
    Write-Success "AWS CLI is installed"
} catch {
    Write-Error "AWS CLI not installed — install from https://aws.amazon.com/cli/"
    exit 1
}

# Test AWS credentials
Write-Host "`nTesting AWS credentials..." -NoNewline
try {
    $account = aws sts get-caller-identity --query Account --output text 2>&1
    Write-Success "AWS credentials valid (Account: $account)"
} catch {
    Write-Error "AWS credentials not configured — run 'aws configure'"
    exit 1
}

# Find instance by IP
if (-not $InstanceId) {
    Write-Host "`nSearching for instance with IP $InstanceIP..."
    try {
        $instances = aws ec2 describe-instances `
            --region $Region `
            --filters "Name=instance-state-name,Values=running" `
            --query "Reservations[].Instances[?PublicIpAddress=='$InstanceIP']" `
            --output json | ConvertFrom-Json
        
        if ($instances.Count -gt 0) {
            $InstanceId = $instances[0].InstanceId
            Write-Success "Found instance: $InstanceId"
        } else {
            Write-Error "No running instance found with IP $InstanceIP"
            
            # Check for stopped instances
            Write-Warning "Checking for stopped instances..."
            $stopped = aws ec2 describe-instances `
                --region $Region `
                --filters "Name=instance-state-name,Values=stopped" `
                --query "Reservations[].Instances[?PublicIpAddress=='$InstanceIP']" `
                --output json | ConvertFrom-Json
            
            if ($stopped.Count -gt 0) {
                Write-Warning "Instance $($stopped[0].InstanceId) is STOPPED. Start it first."
            }
        }
    } catch {
        Write-Error "Error querying instances: $_"
    }
}

if ($InstanceId) {
    Write-Host "`n=== Instance Details ===" -ForegroundColor Cyan
    
    # Get instance info
    try {
        $instance = aws ec2 describe-instances `
            --instance-ids $InstanceId `
            --region $Region `
            --output json | ConvertFrom-Json | Select-Object -ExpandProperty Reservations | Select-Object -ExpandProperty Instances | Select-Object -First 1
        
        Write-Host "Instance ID: $InstanceId"
        Write-Host "State: $($instance.State.Name)"
        Write-Host "Instance Type: $($instance.InstanceType)"
        Write-Host "Public IP: $($instance.PublicIpAddress)"
        Write-Host "Private IP: $($instance.PrivateIpAddress)"
        Write-Host "Subnet ID: $($instance.SubnetId)"
        Write-Host "VPC ID: $($instance.VpcId)"
        
        # Check instance state
        if ($instance.State.Name -ne "running") {
            Write-Error "Instance is in '$($instance.State.Name)' state. It must be 'running' for SSH."
            Write-Host "`nTo start the instance:"
            Write-Host "  aws ec2 start-instances --instance-ids $InstanceId --region $Region"
            exit 1
        }
        
        # Check public IP
        if (-not $instance.PublicIpAddress) {
            Write-Error "Instance does not have a public IP assigned"
            Write-Host "`nTo associate an elastic IP:"
            Write-Host "  aws ec2 allocate-address --domain vpc --region $Region"
            Write-Host "  aws ec2 associate-address --instance-id $InstanceId --allocation-id eipalloc-xxxxx --region $Region"
            exit 1
        }
        
        Write-Success "Instance state is valid"
        
    } catch {
        Write-Error "Error querying instance details: $_"
        exit 1
    }

    Write-Host "`n=== Security Group Analysis ===" -ForegroundColor Cyan
    
    try {
        # Get security groups
        $sgIds = $instance.SecurityGroups | Select-Object -ExpandProperty GroupId
        Write-Host "Security Groups: $($sgIds -join ', ')"
        
        foreach ($sgId in $sgIds) {
            Write-Host "`nChecking $sgId..."
            
            $sg = aws ec2 describe-security-groups `
                --group-ids $sgId `
                --region $Region `
                --output json | ConvertFrom-Json | Select-Object -ExpandProperty SecurityGroups | Select-Object -First 1
            
            # Look for SSH rule
            $sshRule = $sg.IpPermissions | Where-Object { $_.FromPort -eq 22 -or $_.FromPort -eq 0 }
            
            if ($sshRule) {
                Write-Success "SSH (port 22) is open in $sgId"
                foreach ($rule in $sshRule) {
                    if ($rule.IpRanges) {
                        Write-Host "  CIDR: $($rule.IpRanges[0].CidrIp)"
                    }
                }
            } else {
                Write-Error "SSH (port 22) is NOT open in $sgId"
                Write-Host "`nTo add SSH access:"
                Write-Host "  aws ec2 authorize-security-group-ingress -g $sgId -p tcp -f 22 -t 22 -c 0.0.0.0/0 --region $Region"
            }
        }
    } catch {
        Write-Error "Error analyzing security groups: $_"
    }

    Write-Host "`n=== Network ACL Analysis ===" -ForegroundColor Cyan
    
    try {
        $nacls = aws ec2 describe-network-acls `
            --filters "Name=association.subnet-id,Values=$($instance.SubnetId)" `
            --region $Region `
            --output json | ConvertFrom-Json | Select-Object -ExpandProperty NetworkAcls
        
        if ($nacls.Count -gt 0) {
            $nacl = $nacls[0]
            Write-Host "Network ACL: $($nacl.NetworkAclId)"
            
            # Check for SSH rules
            $sshEgress = $nacl.Egress | Where-Object { ($_.PortRange.From -le 22) -and ($_.PortRange.To -ge 22) -and $_.RuleAction -eq "allow" }
            $sshIngress = $nacl.Ingress | Where-Object { ($_.PortRange.From -le 22) -and ($_.PortRange.To -ge 22) -and $_.RuleAction -eq "allow" }
            
            if ($sshEgress -and $sshIngress) {
                Write-Success "SSH rules found in NACL"
            } else {
                Write-Warning "NACL might be blocking SSH traffic"
            }
        }
    } catch {
        Write-Error "Error analyzing NACLs: $_"
    }
}

Write-Host "`n=== SSH Key Verification ===" -ForegroundColor Cyan

if (Test-Path $KeyPath) {
    Write-Success "SSH key found: $KeyPath"
    
    # Check key permissions (Windows - not applicable)
    Write-Host "Checking key format..."
    $keyContent = Get-Content $KeyPath -First 1
    if ($keyContent -match "BEGIN.*PRIVATE KEY") {
        Write-Success "SSH key format is valid"
    } else {
        Write-Error "SSH key format may be invalid"
    }
} else {
    Write-Error "SSH key not found at $KeyPath"
    Write-Host "`nYou need to download your key pair from AWS:"
    Write-Host "  1. Go to https://console.aws.amazon.com/ec2/v2/home"
    Write-Host "  2. Key Pairs - Download the .pem file"
    Write-Host "  3. Save to $KeyPath"
    exit 1
}

Write-Host "`n=== Connection Test ===" -ForegroundColor Cyan

Write-Host "Testing SSH connectivity to $InstanceIP on port 22..."
Write-Host "(Note: This may take 5-30 seconds, please wait...)`n"

# Test connectivity with timeout
$connected = $false
try {
    $socket = New-Object System.Net.Sockets.TcpClient
    $async = $socket.BeginConnect($InstanceIP, 22, $null, $null)
    $wait = $async.AsyncWaitHandle.WaitOne(5000, $false)
    
    if ($wait -and $socket.Connected) {
        Write-Success "Port 22 is OPEN and accepting connections"
        $connected = $true
        $socket.Close()
    } else {
        Write-Error "Port 22 is CLOSED or not responding (timeout)"
        $socket.Close()
    }
} catch {
    Write-Error "Cannot connect to port 22: $_"
}

if ($connected) {
    Write-Host "`n=== SSH Access Ready ===" -ForegroundColor Green
    Write-Host "`nYou can now SSH into the instance:"
    Write-Host "  ssh -i `"$KeyPath`" ubuntu@$InstanceIP`n"
}

Write-Host "`n=== Final Recommendations ===" -ForegroundColor Cyan

if ($script:hasErrors) {
    Write-Host "`nIssues found. Try these fixes (in order):`n"
    Write-Host "1. Verify instance is running"
    Write-Host "   aws ec2 start-instances --instance-ids $InstanceId --region $Region"
    Write-Host ""
    Write-Host "2. Wait 1-2 minutes for network initialization"
    Write-Host ""
    Write-Host "3. Check security group allows SSH on port 22"
    Write-Host "   aws ec2 describe-security-groups --group-ids sg-xxxxx --region $Region"
    Write-Host ""
    Write-Host "4. If still failing, reboot the instance"
    Write-Host "   aws ec2 reboot-instances --instance-ids $InstanceId --region $Region"
    Write-Host ""
    Write-Host "5. Try from a different network or VPN"
    Write-Host ""
    Write-Host "6. Check AWS Systems Manager Session Manager (no SSH required)"
    Write-Host "   aws ssm start-session --target $InstanceId --region $Region"
} else {
    Write-Host ""
    Write-Host "All checks passed! Troubleshooting complete."
    Write-Host ""
}
