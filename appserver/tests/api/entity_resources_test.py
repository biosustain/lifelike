
def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_colors_and_styles(client, test_user, styles_fixture):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    get_response = client.get('/annotations/style', headers=headers)
    assert get_response.status_code == 200
    assert {'styles': []} == get_response.get_json()
