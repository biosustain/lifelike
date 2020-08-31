import pytest
from neo4japp.models import AppUser
from neo4japp.data_transfer_objects import UserUpdateRequest
from neo4japp.util import camel_to_snake_dict


def user_factory(uid):
    return dict(
        username=f'appuser-{uid}',
        firstName=f'firstname-{uid}',
        lastName=f'lastname-{uid}',
        email=f'appuser{uid}@***ARANGO_DB_NAME***.bio',
        roles=['user'],
    )


@pytest.mark.parametrize('user_attribute, new_value', [
    ('username', 'new-username'),
    ('email', 'new-email@***ARANGO_DB_NAME***.bio'),
    ('first_name', '2pac'),
    ('last_name', 'shakur'),
])
def test_can_update_user(session, account_service, user_attribute, new_value):
    user = AppUser().from_dict(user_factory(1))
    password = 'secret'
    user.set_password(password)
    session.add(user)
    session.flush()

    attributes = user.to_dict(exclude=['id', 'creation_date', 'modified_date'])

    attributes.update({user_attribute: new_value})
    attributes['password'] = password
    attributes = camel_to_snake_dict(attributes, {})

    account_service.update_user(user, UserUpdateRequest(**attributes), False)
    updated_user = AppUser.query.get(user.id)

    assert getattr(updated_user, user_attribute) == new_value


def test_can_update_password(session, account_service):
    user = AppUser().from_dict(user_factory(1))
    password = 'secret'
    user.set_password(password)
    session.add(user)
    session.flush()

    attributes = user.to_dict(exclude=['id', 'creation_date', 'modified_date'])
    attributes['newPassword'] = 'mickies'
    attributes['password'] = password
    attributes = camel_to_snake_dict(attributes, {})

    old_password_hash = user.password_hash

    account_service.update_user(user, UserUpdateRequest(**attributes), False)
    updated_user = AppUser.query.get(user.id)

    assert updated_user.password_hash != old_password_hash
