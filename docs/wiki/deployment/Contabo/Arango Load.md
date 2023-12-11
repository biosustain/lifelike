# Load Arango Database

This document will explain the steps require to fully dump and restore an existing ArangoDB.

## Dump An Existing Arango Database [Optional]

```bash
arangodump --server.database <database> --server.endpoint <connection-string> --server.username <username> --server.password <password> --output-directory <fullpath>
```

## Load An Arango Dump Into the Target Database

```bash
arangorestore --server.database <database> --server.endpoint <connection-string> --server.username <username> --server.password <password> --input-directory <fullpath>
```
