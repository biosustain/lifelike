#!/bin/bash

mkdir -p models
gsutil cp -r gs://lifelike_ai_models/bacteria ./models/
gsutil cp -r gs://lifelike_ai_models/chemical ./models/
gsutil cp -r gs://lifelike_ai_models/disease ./models/
gsutil cp -r gs://lifelike_ai_models/gene ./models/

