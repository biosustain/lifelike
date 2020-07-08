#!/bin/bash

sudo gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/bacteria ./models/
sudo gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/chemical ./models/
sudo gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/disease ./models/
sudo gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/gene ./models/

