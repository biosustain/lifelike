# LMDB Kibana
__Overview__
This is meant to be a temporary housing area to help automate seeding LMDB into Elasticsearch for browsing. The reason it being temporary is it takes upwards to an hour to run the entire process and we do not have a pipeline to run long jobs/async jobs at the moment.

# To Run
1. Download and authorize the Google Cloud CLI from https://cloud.google.com/sdk/gcloud to our project
2. Install virtual environment for your Python installation https://docs.python-guide.org/dev/virtualenvs/
3. Run the shell script `lmdb2kibana.sh`
4. Wait while the script loads the data into Elasticsearch
5. View the results at https://elk.prod.lifelike.bio