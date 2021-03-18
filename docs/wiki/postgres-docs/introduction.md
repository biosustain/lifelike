## Creating Schema Diagrams

First install `eralchemy` locally. To see the various methods of installing it, please see https://github.com/Alexis-benoist/eralchemy. Mac OS X users can use `brew install eralchemy`.

Once the app is installed, run the following command to generate the schema:

```sh
eralchemy -i 'postgresql+psycopg2://postgres:postgres@localhost:5431/postgres' -o docs/dev/schema-current.pdf
```

Optionally commit the diagram to the repository (in `docs/dev`).

## Seeding from SQL Dump Files

1. Access PostgreSQL:

   ```sh
   docker-compose exec pgdatabase psql -U postgres -h pgdatabase -d postgres
   ```

2. Drop the current schema:

   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

3. Move the SQL dump file to the top folder of your repository.

4. Load the SQL dump:

   ```sh
   docker-compose exec -T pgdatabase psql -U postgres < $dump_file
   ```

   