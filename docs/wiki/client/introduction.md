# Client Development

## Yarn Packages

### Making Changes

Use the following command to install dependencies:

```sh
docker compose -f docker-compose.dev.yml run --rm --no-deps client yarn add $package_name
```

## Unit Tests

### Running Tests

```sh
docker compose -f docker-compose.dev.yml run --rm --no-deps client yarn test
```

## Lint Checks

### Running Checks

```sh
docker compose -f docker-compose.dev.yml run --rm --no-deps client yarn lint
```
