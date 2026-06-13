// main.bicep — Azure infrastructure for Aranya.ai WhatsApp+Voice service
// Deploys: App Service, Application Insights, Storage Account, Key Vault

param location string = resourceGroup().location
param environment string = 'dev' // dev, staging, prod
param appName string = 'aranya-ai'
param containerImage string = '' // Set to registry.azurecr.io/aranya-ai:latest
param planTier string = 'B2' // B1, B2, B3 for production
param planInstances int = environment == 'prod' ? 2 : 1

// Naming
var uniqueSuffix = uniqueString(resourceGroup().id)
var appServiceName = '${appName}-${environment}-${uniqueSuffix}'
var appInsightsName = '${appName}-ai-${environment}-${uniqueSuffix}'
var storageAccountName = replace('${appName}${environment}${uniqueSuffix}', '-', '')
var keyVaultName = '${appName}-kv-${environment}-${uniqueSuffix}'
var appServicePlanName = '${appName}-plan-${environment}'

// ─────────────────────────────────────────────────────────────────
// Storage Account (for audio cache and backups)
// ─────────────────────────────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// Blob container for audio cache
resource audioContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccountName}/default/audio-cache'
  properties: {
    publicAccess: 'None'
  }
}

// ─────────────────────────────────────────────────────────────────
// Application Insights (monitoring & logging)
// ─────────────────────────────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
    WorkspaceResourceId: resourceId('Microsoft.OperationalInsights/workspaces', '${appName}-logs-${environment}')
  }
}

// ─────────────────────────────────────────────────────────────────
// Key Vault (secrets management)
// ─────────────────────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appServiceIdentity.properties.principalId
        permissions: {
          secrets: ['get', 'list']
          keys: []
          certificates: []
        }
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────
// App Service Plan
// ─────────────────────────────────────────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: planTier
    capacity: planInstances
  }
  properties: {
    reserved: true
  }
}

// ─────────────────────────────────────────────────────────────────
// App Service Identity (for Key Vault access)
// ─────────────────────────────────────────────────────────────────
resource appServiceIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-identity-${environment}'
  location: location
}

// ─────────────────────────────────────────────────────────────────
// App Service (Flask application)
// ─────────────────────────────────────────────────────────────────
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appServiceIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      alwaysOn: true
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'WEBSITE_PYTHON_VERSION'
          value: '3.11'
        }
        {
          name: 'ENVIRONMENT'
          value: environment
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
        {
          name: 'KEY_VAULT_URL'
          value: keyVault.properties.vaultUri
        }
      ]
      connectionStrings: []
    }
  }
}

// App Service app settings (secrets from Key Vault)
resource appServiceAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  name: '${appService.name}/web'
  properties: {
    numberOfWorkers: 1
    defaultDocuments: []
  }
}

// ─────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appInsightsKey string = appInsights.properties.InstrumentationKey
output keyVaultUri string = keyVault.properties.vaultUri
output storageAccountName string = storageAccount.name
