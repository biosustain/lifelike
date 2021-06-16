# AppServer Development

## Python Dependencies

We manage dependencies through *pipenv*. Dependencies are stored in `Pipfile` but their specific versions are stored in an automatically-managed `Pipfile.lock`.

### Making Changes

Use the following command to install dependencies:

```sh
docker-compose exec appserver pipenv install --keep-outdated --python /usr/bin/python3 $dependency_name
```

Note: The `--python` argument is only required if there is a mismatch between the Python version in the Docker container and the Python version in the Pipfile, although it doesn't hurt to add it.

### Dealing with Pipfile Merge Conflicts

If two people add dependencies on different branches, you will run into a merge conflict with `Pipfile`. 

To solve this problem, first combine the changes in `Pipfile`, and then choose one of the versions of `Pipfile.lock`. Afterwards, run this command:

```sh
docker-compose exec appserver pipenv lock --keep-outdated --python /usr/bin/python3 lock
```

## PostgreSQL Migrations

Migrations help modify the schema in our production and local databases using a series of clearly defined and VCS-committed update scripts. We use Alembic for migrations, although it is integrated with Flask, so you will run commands through `flask db` instead of directly through `alembic`.

Alembic migrations are of a tree structure, so each migration has a "prior" migration that it is derived from. When the migration tree forks (such as when two people work on two different Git branches), the two forks eventually have to be merged or one of the forks has to be re-created on top of the other.

### Applying Existing Migrations

By default, the database is empty so you will have to run all the existing migrations to bring your database up to date using the following command:

```sh
docker-compose exec appserver flask db upgrade
```

### Importing Seed Data

While the migrations create the schema, the database still has no data and it may be difficult to develop without any data. We've provided some "seed data" that has dummy accounts and dummy data for you to work with. To **clear your current local database** and import the seed data, run:

```sh
docker-compose exec appserver flask seed
```

### Making Schema Changes

When you make changes to the schema, by perhaps changing one of the models or creating a new model, you will have to create a new migration script so your local database and the production database has the changes.

First, make sure that you are up to date on migrations by first applying them using the `upgrade` command described above. Otherwise, you will see this error:

```
ERROR [root] Error: Target database is not up to date.
```

Once you are up to date, you can have Alembic generate a migration script for you by automatically inspecting the current schema structure as described in the code and comparing it to the one in the database. Run the following command to create a new migration script in `appserver/migrations`:

```sh
docker-compose exec appserver flask db migrate -m "Describe the change here"
```

If you don't want an auto-generated migration file, you can run this command instead:

```sh
docker-compose exec appserver flask db revision -m "Describe the change here"
```

#### Don't Forget About Data Migrations

If you are changing existing schema, don't forget that production still has existing data that may have to be updated to the new schema.

To perform data migrations, edit the created migration script and add the necessary transformation code to the script, but **do not import models from the app,** because the models will change overtime whereas your migration script will not! Instead, redefine the tables that you need to work on in your migration script, as illustrated below:

```python
import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('hash_id'),
    sa.Column('username'),
    sa.Column('email'),
    sa.Column('first_name'),
    sa.Column('last_name'),
)

session = Session(op.get_bind())

for user in iter_query(session.query(t_app_user), batch_size=DEFAULT_QUERY_BATCH_SIZE):
    user = user._asdict()
    session.execute(t_app_user.update().values(
        hash_id=create_hash_id()
    ).where(t_app_user.c.id == user['id']))
```

### Merging Migration Conflicts

As previously described, if two people are working on migrations, you will end up with a migration conflict. When you apply migrations in such a scenario, you will receive the following error:

```
ERROR [root] Error: Multiple head revisions are present for given argument 'head'; please specify a specific target revision, '<branchname>@head' to narrow to a specific head, or 'heads' for all heads
```

If you want to see which two (or more) migrations are conflicting, use this command:

```sh
docker-compose exec appserver flask db heads
```

#### Option 1: Merging Heads

If both heads can be merged together because they don't conflict, you can simply run the following command to automatically create another migration that merges the two forks together:

```sh
docker-compose exec appserver flask db merge -m "Describe the merge here"
```

#### Option 2: 'Rebasing' Heads

Sometimes, you do not want to create a merge migration -- in such cases, you can also modify one of the conflicting migration files and change its `down_revision` variable (in the file) to the revision ID of the other conflicted migration, therefore moving one of the migrations to the end of the tree.

## Debugging

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

## Unit Tests

### Running Tests

To run the unit tests for Flask, use the following commands when Flask is running:

```sh
docker-compose exec appserver pytest
```

To run a specific test file:

```sh
docker-compose exec appserver pytest -k tests/api/filesystem/object_test.py
```

To run a specific test:

```sh
docker-compose exec appserver pytest -k tests/api/filesystem/object_test.py::test_patch_file
```

Some additional flags that may make tests easier to read include:

* `--disable-pytest-warnings` to disable warning summaries
* `--capture=no` to show stdout/stderr for all and not just failed tests
* `--verbose` to show test names and not just '.'
* `--tb=native` to show stack traces the normal Python way
* `--ignore=tests/some/test.py` to ignore a specific test or folder

Together:

```sh
docker-compose exec appserver pytest --disable-pytest-warnings --capture=no --verbose --tb=native
```

## Lint Checks

### Running Checks

```sh
docker-compose exec appserver pycodestyle .
docker-compose exec appserver mypy .
```