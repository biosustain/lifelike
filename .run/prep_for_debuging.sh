#!/bin/bash
docker-compose build appserver
docker-compose -f docker-compose.yml -f docker-compose.override.yml -f .run/assets/docker-compose.yml build builder appserver
