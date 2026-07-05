# Install AWS CLI on Windows

## Option 1: Using Chocolatey (Recommended)

```powershell
# Install Chocolatey first (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install AWS CLI
choco install awscli -y

# Verify installation
aws --version
```

## Option 2: Using MSI Installer (Official)

1. Download: https://awscli.amazonaws.com/AWSCLIV2.msi
2. Run the installer
3. Follow the prompts
4. Open new PowerShell and verify:
   ```powershell
   aws --version
   ```

## Option 3: Using Python pip

```powershell
# Install AWS CLI via pip
pip install awscli

# Verify
aws --version
```

## Configure AWS CLI

After installation, configure your credentials:

```powershell
aws configure

# You'll be prompted for:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region name: us-east-1
# Default output format: json
```

### Where to Get Credentials

1. Go to AWS Console: https://console.aws.amazon.com
2. Click on your account name → Security Credentials
3. Access Keys → Create New Access Key
4. Copy the Access Key ID and Secret Access Key
5. Use them in `aws configure`

---

## Quick Install & Configure Script

```powershell
# Install AWS CLI using MSI (recommended)
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri 'https://awscli.amazonaws.com/AWSCLIV2.msi' -OutFile 'AWSCLIV2.msi'
Start-Process msiexec.exe -Wait -ArgumentList '/i AWSCLIV2.msi /quiet'
Remove-Item AWSCLIV2.msi

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify
aws --version

# Configure (you'll need to enter credentials)
aws configure
```

---

## Verify Installation

```powershell
aws --version
aws sts get-caller-identity
```

If the second command works, AWS CLI is ready to use.
