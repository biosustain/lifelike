#!/bin/bash
docker-compose build appserver
docker-compose -f /Users/dommas/Projects/kg-prototypes/docker-compose.yml -f /Users/dommas/Projects/kg-prototypes/docker-compose.override.yml -f /Users/dommas/Projects/kg-prototypes/.run/assets/docker-compose.yml -f /Users/dommas/Library/Caches/JetBrains/PyCharm2020.3/tmp/docker-compose.override.3.yml build builder appserver