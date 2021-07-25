# Lifelike-graphdb

This README describes how to set up a develoment environment for Lifelike-graphdb and how to load data into the graph.

## Initial setup

Development and deployment depends on the `Pipenv` tool to create a virtual environment with all dependencies found in the `Pipfile`. When opening a Pipenv shell, it automatically loads variables found in the `.env` file.

### Set environment variables
Make a copy of `template.env` and set values for the environment variables.
This is required for both development and deployment:

``` bash
cp template.env .env
nano .env
```

### Install Pipenv
Make sure Pipenv is installed:

``` bash
sudo apt install pipenv
```

### Create virtual environment
Create a virtual environment for the project and install dependencies from Pipfile (incl. dev dependencies):

``` bash
pipenv install --dev
```

### Activate virtual environment
``` bash
pipenv shell
```

Deactivate the shell using `exit`.

### Update dependencies in virtual environment

Make sure that the dependencies in the virtual environment complies with the dependencies specified in `Pipfile`.

Check if anything has changed upstream:
``` bash
pipenv update --outdated
```

Update all packages:
``` bash
pipenv update
```

Or update a specific package:
``` bash
pipenv update <package>
```

## Loading data to the graph

Data is parsed and loaded to the graph by executing the `app.py` script with the data domain as argument. Some domains, like BioCyc, will have additional arguments to specify  which specific data sources to load.

Data source files are loaded from the folder \<base data dir>/download/\<domain name>, e.g. /mnt/data/graphdata/download/biocyc.
Base data dir is set in environment variable BASE_DATA_DIR.

### Arguments
Required:

domain: name of data domain, like "biocyc".

Optional:

--log-level: Override the default (INFO) log level.

--log-file: Name of log file. If specified, logs are written to this files.

### Examples

Load Chebi with default (INFO) log level:
``` bash    
python3 ./***ARANGO_DB_NAME***_graphdb/app.py chebi
```

Load Chebi, overriding log level and specifying log file:
``` bash    
python3 ./***ARANGO_DB_NAME***_graphdb/app.py --log-file kg_load.log --log-level DEBUG chebi
```

Load all BioCyc sources as specified in ../***ARANGO_DB_NAME***_graphdb/biocyc/data_sources.json:
``` bash    
python3 ./***ARANGO_DB_NAME***_graphdb/app.py biocyc
```

Load specific BioCyc data sources:
``` bash    
python3 ./***ARANGO_DB_NAME***_graphdb/app.py biocyc --data-sources EcoCyc YeastCyc MetaCyc
```