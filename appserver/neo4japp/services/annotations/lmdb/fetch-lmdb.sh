#!/bin/bash

gsutil cp -r gs://lmdb_database/chemicals ./
gsutil cp -r gs://lmdb_database/compounds ./
gsutil cp -r gs://lmdb_database/diseases ./
gsutil cp -r gs://lmdb_database/genes ./
gsutil cp -r gs://lmdb_database/phenotypes ./
gsutil cp -r gs://lmdb_database/proteins ./
gsutil cp -r gs://lmdb_database/species ./
