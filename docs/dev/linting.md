# Linting
This doc describes best practices within the project regarding linting of the client and appserver code.

## Best Practices
Each developer is accountable for linting their code before pushing or merging it. Lint issues should be caught by CI before a PR is merged, but you will be saving yourself and others time if you always lint before pushing your code (you don't want your tests to be running for 15 minutes on CI only to fail once they get to a trivial linting issue).

For the commands below, it is highly recommended to create bash aliases so you can run them quickly. To do so, open your bash profile and add something like the following:

```bash
alias lifelike-lint-appserver="echo Running linters on Lifelike appserver...; docker-compose exec appserver bash -c 'mypy . || pycodestyle'"
```

Then you can simply run `lifelike-lint-appserver` to run both `mypy` and `pycodestyle` on the appserver.

## Client
To lint the client, run the command:
```
docker-compose exec client yarn lint
```

## Appserver
To lint the appserver, run these commands:
```
docker-compose exec appserver mypy . || docker-compose exec appserver pycodestyle
```
