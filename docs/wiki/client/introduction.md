# Client Development

## Yarn Packages

### Making Changes

Use the following command to install dependencies:

```sh
docker-compose exec client yarn add $package_name
```

## Unit Tests

### Running Tests

```sh
docker-compose exec client yarn test
```

## Lint Checks

### Running Checks

```sh
docker-compose exec client yarn lint
```
