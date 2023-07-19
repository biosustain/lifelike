# API Documentation

**Authorized Endpoints**
Get a token to authorize. The exampe below uses the `jq` library to parse out the token.

On Mac, this can be installed via `brew install jq`

```bash
curl http://localhost:5000/auth/login \
    -s \
    -X POST \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data '{"email":"user@gmail.com","password":"hai_password"}' | jq -r .access_jwt
```

## Drawing Tool API

**Fetch a specific drawing map**

```
/drawing-tool/map/SOMEHASHID
```

> Accepts: GET

```bash
curl http://localhost:5000/drawing-tool/map/ff9a709b3121ce9324b34ec00a110966 \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer eyJ0eXAiO-YOUR-TOKEN-HERE"
```

> Returns the JSON representation of the drawing map and related meta data

**Download the map as a JSON file**

```
/drawing-tool/map/download/SOMEHASHID
```

> Accepts: GET

```bash
curl http://localhost:5000/drawing-tool/map/download/ff9a709b3121ce9324b34ec00a110966 \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer eyJ0eXAiO-YOUR-TOKEN-HERE"
```

> Returns the JSON file of the map
