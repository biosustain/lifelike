import json

import pytest
import yaml

from neo4japp.services.chat_gpt import ChatGPT


@pytest.mark.parametrize(
    'params, validation_query',
    [
        (dict(entities=['PER1', 'Autism']), 'Answer mentions that PER1 is reduced for persons with Autism'),
    ],
)
def test_relationship_query_fits_examples(client, session, params, validation_query):
    response = client.post(
        '/explain/relationship',
        data=json.dumps(params),
        content_type='application/json',
    )

    print(response.json)

    create_params = dict(
        model="gpt-3.5-turbo",
        messages=[
            dict(
                role="system",
                content="You are QA testing suite. Given answer and validation query respond with 'TRUE' or 'FALSE'."
            ),
            dict(
                role="user",
                content=yaml.dump({
                    'Answer': response.json.get('result'),
                    'Validation Query': validation_query,
                })
            )
        ],
        temperature=0,
        max_tokens=20,
    )
    response = ChatGPT.ChatCompletion.create(**create_params)
    for choice in response.get('choices'):
        assert choice.get('message').get('content').strip() == 'TRUE'
