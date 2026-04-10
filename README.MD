# Azure TODO Application - Projet d'Évaluation

Ce projet consiste en une application de gestion de tâches (TODO List) conteneurisée et déployée sur **Azure**. L'architecture met l'accent sur la sécurité, la persistance des données et la scalabilité.

## Stack Technique
- **Frontend** : React (Vite)
- **Backend** : Node.js (Express)
- **Base de données** : Azure Cosmos DB (API MongoDB)
- **Conteneurisation** : Docker
- **Cloud** : Azure (App Service, ACR, Key Vault, Blob Storage)

---

## Architecture Cloud
L'infrastructure repose sur plusieurs services Azure interconnectés pour garantir une séparation des responsabilités et une sécurité maximale :

1.  **Azure App Service** : Héberge l'application via un conteneur Docker.
2.  **Azure Container Registry (ACR)** : Stocke les images Docker privées.
3.  **Azure Cosmos DB** : Assure la persistance des données (tâches).
4.  **Azure Key Vault** : Centralise les secrets (chaîne de connexion).
5.  **Azure Blob Storage** : Reçoit les exports JSON des tâches.

---

## Sécurité & Identité
Pour éviter de stocker des mots de passe "en clair" dans le code ou les variables d'environnement, nous avons mis en place :
- **Identité Managée** : L'App Service possède sa propre identité dans Azure AD.
- **Key Vault Access Policy** : Seule l'identité de l'application est autorisée à lire les secrets du coffre-fort.
- **Key Vault References** : L'application récupère la connexion à la base de données via une URI sécurisée : `@Microsoft.KeyVault(SecretUri=...)`.

---

## Déploiement et Exploitation

### Multi-environnement (Slots)
Nous utilisons des **Deployment Slots** pour séparer les environnements :
- **Production** : Version stable accessible aux utilisateurs.
- **Staging** : Environnement de test pour valider les nouvelles versions avant le "Swap".

### Scalabilité
L'application est déployée sur un plan **S1** permettant le **Scaling horizontal** (multiplication des instances).
- Commande utilisée : `az appservice plan update --number-of-workers 2`

### Persistance & Fichiers
- Les tâches sont stockées de façon permanente dans **Cosmos DB**.
- Une fonctionnalité d'export (`/api/export`) génère un fichier JSON daté et le téléverse vers **Azure Blob Storage**.

### Les urls de production et de staging
- Production : [https://apptodo28092.azurewebsites.net/](https://apptodo28092.azurewebsites.net/)
- Staging : [https://apptodo28092-staging.azurewebsites.net/](https://apptodo28092-staging.azurewebsites.net/)

---

## Commandes Principales (CLI) : Historique du Projet

Voici l'ensemble des commandes Azure CLI et Docker utilisées pour construire cette infrastructure étape par étape.

### 1. Variables globales
```bash
RG_NAME="rg-todo-evaluation"
LOCATION="germanywestcentral"
ACR_NAME="acrtodo12536"
APP_NAME="apptodo28092"
PLAN_NAME="plan-todo-app"
```

### 2. Création de l'infrastructure de base et du Registre Docker (ACR)
```bash
az group create --name $RG_NAME --location $LOCATION

# Activation du fournisseur pour les comptes étudiants
az provider register --namespace Microsoft.ContainerRegistry

# Création de l'ACR
az acr create --resource-group $RG_NAME --name $ACR_NAME --sku Basic --admin-enabled true
az acr login --name $ACR_NAME
```

### 3. Docker Build & Push (avec correction d'architecture Apple Silicon)
```bash
# Compilation forcée pour les serveurs Azure (AMD64)
docker build --platform linux/amd64 -t azure-todo-app .
docker tag azure-todo-app $ACR_NAME.azurecr.io/azure-todo-app:v3
docker push $ACR_NAME.azurecr.io/azure-todo-app:v3
```

### 4. Déploiement de l'App Service
```bash
# Création du plan et de l'application web
az appservice plan create --resource-group $RG_NAME --name $PLAN_NAME --is-linux --sku B1
az webapp create --resource-group $RG_NAME --plan $PLAN_NAME --name $APP_NAME --deployment-container-image-name $ACR_NAME.azurecr.io/azure-todo-app:v3

# Authentification de l'App Service auprès de l'ACR
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
az webapp config container set --name $APP_NAME --resource-group $RG_NAME \
  --docker-custom-image-name $ACR_NAME.azurecr.io/azure-todo-app:v3 \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_NAME \
  --docker-registry-server-password $ACR_PASSWORD

# Configuration du port d'écoute Node.js
az webapp config appsettings set --resource-group $RG_NAME --name $APP_NAME --settings WEBSITES_PORT=8080
```

### 5. Base de données Cosmos DB
```bash
az provider register --namespace Microsoft.DocumentDB
COSMOS_NAME="cosmos-todo-$RANDOM"

# Création de la base MongoDB (sans redondance de zone pour compatibilité étudiant)
az cosmosdb create --name $COSMOS_NAME --resource-group $RG_NAME --kind MongoDB --server-version 4.2 --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False

# Récupération de la chaîne de connexion
MONGODB_URI=$(az cosmosdb keys list --type connection-strings --name $COSMOS_NAME --resource-group $RG_NAME --query "connectionStrings[0].connectionString" -o tsv)
```

### 6. Sécurisation avec Azure Key Vault et Identité Managée
```bash
az provider register --namespace Microsoft.KeyVault
KV_NAME="kvtodo$RANDOM"

# Création du coffre-fort (Désactivation du RBAC pour privilégier les Access Policies)
az keyvault create --name $KV_NAME --resource-group $RG_NAME --location $LOCATION
az keyvault update --name $KV_NAME --resource-group $RG_NAME --enable-rbac-authorization false

# Attribution des droits à l'administrateur et sauvegarde du secret
az keyvault set-policy --name $KV_NAME --object-id <MON_OBJECT_ID> --secret-permissions set get list delete
az keyvault secret set --vault-name $KV_NAME --name "MongoDBConnection" --value "$MONGODB_URI"

# Création de l'Identité Managée pour l'App Service
PRINCIPAL_ID=$(az webapp identity assign --name $APP_NAME --resource-group $RG_NAME --query principalId -o tsv)

# Autorisation de l'App Service à lire le Key Vault
az keyvault set-policy --name $KV_NAME --object-id $PRINCIPAL_ID --secret-permissions get

# Injection de la référence Key Vault dans l'App Service
SECRET_URI=$(az keyvault secret show --name "MongoDBConnection" --vault-name $KV_NAME --query id -o tsv)
az webapp config appsettings set --name $APP_NAME --resource-group $RG_NAME --settings MONGODB_URI="@Microsoft.KeyVault(SecretUri=$SECRET_URI)"
```

### 7. Azure Blob Storage (Export JSON)
```bash
az provider register --namespace Microsoft.Storage
STORAGE_NAME="sttodo$RANDOM"

# Création du compte de stockage et du conteneur
az storage account create --name $STORAGE_NAME --resource-group $RG_NAME --location $LOCATION --sku Standard_LRS --min-tls-version TLS1_2
STORAGE_CONN_STR=$(az storage account show-connection-string --name $STORAGE_NAME --resource-group $RG_NAME --query connectionString -o tsv)
az storage container create --name exports --connection-string "$STORAGE_CONN_STR"

# Ajout de la variable d'environnement pour l'application
az webapp config appsettings set --name $APP_NAME --resource-group $RG_NAME --settings AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN_STR"
```

### 8. Exploitation : Slots, Logs et Scaling
```bash
# Upgrade du plan pour débloquer les Slots de déploiement
az appservice plan update --name $PLAN_NAME --resource-group $RG_NAME --sku S1

# Création et configuration du Slot "Staging"
az webapp slot create --name $APP_NAME --resource-group $RG_NAME --slot staging

# Surveiller les logs en direct
az webapp log config --name $APP_NAME --resource-group $RG_NAME --slot staging --docker-container-logging filesystem
az webapp log tail --name $APP_NAME --resource-group $RG_NAME --slot staging

# Swap (Échange) Staging vers Production
az webapp deployment slot swap --resource-group $RG_NAME --name $APP_NAME --slot staging --target-slot production

# Mise à l'échelle manuelle (Scaling out)
az appservice plan update --name $PLAN_NAME --resource-group $RG_NAME --number-of-workers 2
```
---

## Limites et Difficultés Rencontrées

Durant le déploiement de ce projet, plusieurs limitations techniques ont été identifiées et résolues :

1. **Incompatibilité d'architecture processeur (Apple Silicon vers Azure) :**
   - *Problème :* L'image Docker construite localement sur un Mac M1/M2/M3 (ARM64) déclenchait une erreur `exec format error` sur l'App Service Azure qui tourne sous processeur Intel/AMD (AMD64).
   - *Solution :* Forçage de l'architecture lors de la compilation avec la commande `docker build --platform linux/amd64`.

2. **Restrictions de l'abonnement "Azure for Students" :**
   - *Problème :* Des erreurs `MissingSubscriptionRegistration` empêchaient la création des ressources (ACR, Cosmos DB, Key Vault, Storage). Les services n'étaient pas activés par défaut sur le compte étudiant.
   - *Solution :* Enregistrement manuel des fournisseurs via `az provider register --namespace Microsoft.<Service>`.

3. **Capacité des régions et redondance de zone :**
   - *Problème :* Impossible de créer Cosmos DB dans la région initiale (`uaenorth`) à cause d'une forte demande et du manque de serveurs dans cette zone.
   - *Solution :* Changement de la région vers `germanywestcentral` et désactivation de la redondance de zone (`isZoneRedundant=False`).

4. **Permissions par défaut du Key Vault (RBAC) :**
   - *Problème :* Le modèle de permission par défaut (RBAC) bloquait la création de secrets (`ForbiddenByRbac`), même pour le créateur de la ressource.
   - *Solution :* Désactivation du RBAC au profit des "Access Policies" classiques pour autoriser l'injection du secret via l'Object ID.

---

## Auteur
- **Lutfi SIMSEK**
- **Julian CHRISTMANN**