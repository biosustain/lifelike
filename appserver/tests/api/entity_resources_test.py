
def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_colors_and_styles(client, test_user, styles_fixture):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    get_response = client.get('/annotations/style', headers=headers)

    assert get_response.status_code == 200
    assert {
               'styles': [
                   {
                       'color': '#232323',
                       'icon_code': None,
                       'label': 'gene',
                       'style': {
                           'background': None,
                           'border': None,
                           'color': None
                       }
                   },
                   {
                       "label": "association",
                       "color": "#d7d9f8",
                       "icon_code": None,
                       "style": {
                           "border": "#d7d9f8",
                           "background": "#d7d9f8",
                           "color": "#000"
                       }
                   }
               ]
           } == get_response.get_json()


def test_user_can_get_specific_color_and_style(client, test_user, styles_fixture):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    get_response = client.get('/annotations/style/association', headers=headers)

    assert get_response.status_code == 200
    assert {
               "label": "association",
               "color": "#d7d9f8",
               "icon_code": None,
               "style": {
                   "border": "#d7d9f8",
                   "background": "#d7d9f8",
                   "color": "#000"
               }
           } == get_response.get_json()
