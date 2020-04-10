import json

from neo4japp.models import AppUser


def test_uri_hash(
    client,
    fix_project,
):
    # Get owner JWT
    response = client.post(
        '/auth/login',
        data=json.dumps(dict(
            email="admin@***ARANGO_DB_NAME***.bio",
            password='password'
        ))
    )

    headers = {
        'Authorization': 'Bearer {}'.format(response.data.access_jwt)
    }

    response = client.get(
        '/drawing-tool/map/',
        headers=headers
    )

    assert response.status_code == 200
