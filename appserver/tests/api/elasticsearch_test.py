def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_search_content(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    resp = client.post(
        f'/search/content',
        headers=headers,
        data={
            'q': 'BOLA3',
            'mimeTypes': ['vnd.lifelike.document/map', 'application/pdf'],
            'limit': 10,
            'page': 1
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 200
