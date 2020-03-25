# KG-PROTOTYPES
- An amalgamation of all protoypes hooked up into one another for a MVP

Sets up a Dockerized Flask and Neo4j application using ```docker-compose``` for experimenting. Flask and Neo4j communication is done through **py2neo**.

## DEV F.A.Q
__1. How do I run the application?__


To run the application, first create the docker images
```
docker-compose build --no-cache
```

(Optional) - Set up a `node_modules` folder for local development. This is used for autocomplete, but will not allow you to run Angular locally (e.g. you'll have to use Docker to run `ng serve`)

To create a `node_module` folder locally for IDE autocompletes, run the command
```
docker-compose run client yarn install
```

Next, download the necessary NEO4J database and __decompress__ the Elastic Search database. See FAQ for more information.

Then to spin up the server and bring it down use
```docker-compose up``` and ```docker-compose down``` respectively

Next, run ```docker-compose exec appserver python db/neo4jsetup.py``` to setup the database indexes for full text search

**Note:** The application will be seeded with demo data, so the default login can be found under ```appserver/fixtures/seed.json```

__2. How do I seed the NEO4J Database?__

Download the `.zip` file from https://console.cloud.google.com/storage/browser/graphdb_backup?project=able-goods-221820 and add it to the `neo4j/database` directory. The directory structure will be `neo4j/database/graph.db`.

OR

See the backup in the repository under neo4j/data/databases/text-mining-subset-graphdb.tar

**NOTE** The backup database currently only works with Neo4j version 3.x.x.

__3. How do I seed the Elastic Search Database?__

Decompress the file in elasticsearch/esdata_20191029.tar.gz

__4. API Endpoint Documentation?__

TODO
