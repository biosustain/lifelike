# Appserver Test Dev README

The server has three test types:

- `unit`: Unit tests run completely independent of the database.
- `database`: Database tests use a `session` fixture to roll back any changes
  after the test ends.
- `api`: API tests have `httpclient` and `session` fixtures. They also roll back
  changes after the test ends.

To run `pytest` inside the appserver Docker container, run the command `docker-compose exec appserver pytest tests`.