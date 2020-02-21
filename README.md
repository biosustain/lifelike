# KG-PROTOTYPES
- An amalgamation of all protoypes hooked up into one another for a MVP

Sets up a Dockerized Flask and Neo4j application using ```docker-compose``` for experimenting. Flask and Neo4j communication is done through **py2neo**.

## DEV F.A.Q
__1. How do I run the application?__

You will first need to initialize and pull the toolbar-menu submodule if you have not already. To do so, run the following commands:

```bash
git submodule init
git submodule update
cd client/toolbar-menu
npm install
npm run build
```

More info on submodules: https://git-scm.com/book/en/v2/Git-Tools-Submodules

To run the application, first create the docker images
```
docker-compose build --no-cache
```

(Optional) - Set up a `node_modules` folder for local development. This is used for autocomplete, but will not allow you to run Angular locally (e.g. you'll have to use Docker to run `ng serve`)

To create a `node_module` folder locally for IDE autocompletes, run the command
```
docker-compose run client yarn install
```

Next, download the necessary NEO4J database and decompress the Elastic Search database. See FAQ for more information.

Then to spin up the server and bring it down use
```docker-compose up``` and ```docker-compose down``` respectively

__2. How do I seed the NEO4J Database?__

Download the `.zip` file from https://console.cloud.google.com/storage/browser/graphdb_backup?project=able-goods-221820 and add it to the `db` directory. The directory structure will be `db/graph.db`.

**NOTE** The backup database currently only works with Neo4j version 3.x.x.

__3. How do I seed the Elastic Search Database?__

Decompress the file in elasticsearch/esdata_20191029.tar.gz

__4. API Endpoint Documentation?__

TODO

## TODO
- ~~Add an example API endpoint using py2neo~~
  - *See blueprints directory*
- ~~Add a JavaScript client~~
  - *Angular 2 added as a client*
- Compelely remove 'template' folders from application server
- Handle neo4j transactions
- ~~Add Angular Material for styling~~
- Middleware to translate ```vis.js``` data to be compatible with ```py2neo (neo4j)```
- Implement DTU Navigation bar
- ~~Adding NgRx (Redux) to the stack~~
- Handle saving vis.js data to Neo4J
- Add a seed database
- Handle Elastic Search transactions
## Considerations
- Adding GraphQL to the stack
