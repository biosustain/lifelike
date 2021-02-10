# az webapp create --resource-group lifelike-ecosystem \
#                  --plan lifelike-plan \
#                  --name lifelike-appserver \
#                  --deployment-container-image-name lifelike.azurecr.io/kg-appserver:latest

# Create a docker-compose version
az webapp create --resource-group lifelike-ecosystem \
                 --plan lifelike-plan \
                 --name lifelike-app \
                 --multicontainer-config-type compose \
                 --multicontainer-config-file docker-compose.azure.yml
