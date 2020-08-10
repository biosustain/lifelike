# FAQ

## Table of Contents
- [FAQ](#faq)
  - [Table of Contents](#table-of-contents)
  - [How do I set up my developer environment?](#how-do-i-set-up-my-developer-environment)
  - [How do I add new packages to package.json?](#how-do-i-add-new-packages-to-packagejson)
  - [How do I connect to the neo4j container?](#how-do-i-connect-to-the-neo4j-container)
  - [How do I connect to the postgres container?](#how-do-i-connect-to-the-postgres-container)
  - [How do I debug a running application locally?](#how-do-i-debug-a-running-application-locally)
  - [How do I remote ssh into a running container?](#how-do-i-remote-ssh-into-a-running-container)
  - [How do I update database with new changes?](#how-do-i-update-database-with-new-changes)
  - [How do I run unit tests for Flask?](#how-do-i-run-unit-tests-for-flask)
  - [How do I run unit tests for Angular?](#how-do-i-run-unit-tests-for-angular)
  - [How do I run linting checks?](#how-do-i-run-linting-checks)
  - [How do I create a postgres schema diagram?](#how-do-i-create-a-postgres-schema-diagram)
  - [How can I seed a local database with data from sql dump files?](#how-can-i-seed-a-local-database-with-data-from-sql-dump-files)
  - [Where can I find common design patterns?](#where-can-i-find-common-design-patterns)

## How do I set up my developer environment?
To build run the application, first create the docker images

__Build__
```bash
docker-compose build --no-cache
```

__Run__
```bash
docker-compose up
```
OR the *less verbose version*
```bash
docker-compose up -d
```

Lastly, set up the local neo4j index through running

```bash
docker-compose exec appserver flask init-neo4j
```
**Note:** Do not run this command when connected to the production database.


__(Optionals)__
1. To setup `node_modules` folder for local development, run the following command
```
yarn install --frozen-lockfile
```

2. To seed the application with mock data, run the following command
```
docker-compose exec appserver flask seed
```

3. To work with the NLP (nlpapi) service, the script `fetch-ai-models.sh` must be ran to populate the `models` folder.


## How do I add new packages to package.json?
1. Run the following
```
docker-compose exec client yarn add <package name>
```

2. Ensure the package has been installed in the `package.json` and `yarn.lock` file

3. Commit the `package.json` and `yarn.lock` file

Why not install it directly via `yarn install` locally? There's a potential for the package manager to use the incorrect binaries between linux and (macOS/Windows).

__Other Notes__
1. Run `docker-compose down` to stop the application.
2. The PostgreSQL database is currently being seeded on start up (after `docker-compose up`) which means you may find the login credentials listed in [here](../appserver/fixtures/seed.json).

## How do I connect to the neo4j container?
```
docker-compose exec database cypher-shell -u neo4j
```

## How do I connect to the postgres container?
```
docker-compose exec pgdatabase psql -U postgres -h pgdatabase -d postgres
```

## How do I debug a running application locally?
This means the application is running and once you hit a certain line in the code
while going through the application UI, the code will break at that point.

To do this, first edit the `docker-compose.yml` file for the `appserver` service. Add the following:

```yml
stdin_open: true
tty: true
```
Next, add the following to the part of the code that you want to break at:

```python
import pdb
pdb.set_trace()
```

Restart the application with the following commands:

```bash
docker-compose down && docker-compose up -d
# seed if needed...
docker attach <service_name> # e.g n4j-appserver
```
To exit out of attach mode, can do either `Ctrl+C` to exit and kill the container. Or `Ctrl+P, Ctrl+Q` to detach without killing. It's also possible to add new breakpoints without stopping the container like that since our setup allows updates to the containers automatically.

## How do I remote ssh into a running container?
In rare occasions where you need to ssh into the container as ***ARANGO_USERNAME***: `docker exec -u 0 -it <container_name> bash`.

If you need to edit a file for debugging:

```bash
apt-get update
apt-get install vim
```

## How do I update database with new changes?
Database migration workflow can be found [here](https://github.com/SBRG/kg-prototypes/blob/master/appserver/migrations/README.md)

## How do I run unit tests for Flask?
To run the unit tests for Flask, use the following commands when Flask is running

```bash
docker-compose exec appserver pytest
```

To run a specific test
```bash
docker-compose exec appserver pytest -k <name of test or file>
```

## How do I run unit tests for Angular?
```bash
docker-compose exec client yarn test
```

## How do I run linting checks?
For the client (Angular) application, use
```bash
docker-compose exec client yarn lint
```

For the server (Flask) application, use
```bash
docker-compose exec appserver pycodestyle .
docker-compose exec appserver mypy .
```

The document located [HERE](./dev/linting.md) also has more tips on a shortcut for performing these linting tasks

## How do I create a postgres schema diagram?
1. To create a schema diagram, first run the application
```bash
docker-compose up -d
```

2. Install the `eralchemy` locally. To see the various methods of installing it, please see https://github.com/Alexis-benoist/eralchemy

For macOS users, use
```bash
brew install eralchemy
```

3. Run the following command to generate the schema
```bash
eralchemy -i 'postgresql+psycopg2://postgres:postgres@localhost:5431/postgres' -o docs/dev/schema-current.pdf
```

4. (Optional) Commit the schema update to the repository

## How can I seed a local database with data from sql dump files?
### With production database
1. Access postgres:
`docker-compose exec pgdatabase psql -U postgres -h database -d postgres`
2. Drop the current schema using these commands in psql:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```
3. Move the sql dump file to the top-level of the app, i.e.:
```
- kg-visualizer
  |-- your_dump_file.sql
```
4. Load the sql dump:

`docker-compose exec -T pgdatabase psql -U postgres < <dump file.sql>`

## Where can I find common design patterns?
https://github.com/SBRG/kg-prototypes/wiki
