import pytest
from neo4japp.models import AppUser


@pytest.mark.parametrize('exclude', [
    (['id']),
    (['id', 'username']),
    (['password_hash']),
])
def test_can_exclude_model_props_on_serialization(fix_owner, exclude):
    serialized = fix_owner.to_dict(exclude=exclude)
    for prop in exclude:
        assert prop not in serialized
