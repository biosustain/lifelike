# KG-PROTOTYPES
- An amalgamation of all protoypes hooked up into one another for a MVP

Sets up a Dockerized Flask and Neo4j application using ```docker-compose``` for experimenting. Flask and Neo4j communication is done through **py2neo**.

## DEV F.A.Q
__1. How do I run the application?__
To run the application, first create the docker images
```
docker-compose build --no-cache
```
Then to spin up the server and bring it down use
```docker-compose up``` and ```docker-compose down``` respectively

__2. How do I seed the NEO4J Database?__
Download the `.zip` file from https://github.com/SBRG/knowledge-graph/blob/master/neo4j/data/databases/graph.db.zip and add it to the `db` directory. The directory structure will be `db/graph.db`.

__3. API Endpoint Documentation?__
TODO

## TODO
- ~~Add an example API endpoint using py2neo~~
  - *See blueprints directory*
- ~~Add a JavaScript client~~
  - *Angular 2 added as a client*
- Compelely remove 'template' folders from application server
- Handle neo4j transactions
- Add Angular Material for styling
- Middleware to translate ```vis.js``` data to be compatible with ```py2neo (neo4j)```
- Implement DTU Navigation bar
- ~~Adding NgRx (Redux) to the stack~~
- Handle saving vis.js data to Neo4J
- Add a seed database
## Considerations
- Adding GraphQL to the stack
