#!/bin/bash

mkdir -p models
gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/bacteria ./models/
gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/chemical ./models/
gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/disease ./models/
gsutil cp -r gs://***ARANGO_DB_NAME***_ai_models/gene ./models/

