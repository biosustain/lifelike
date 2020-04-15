import attr

from neo4japp.util import CamelDictMixin

from typing import List


@attr.s(frozen=True)
class UserRequest(CamelDictMixin):
    username: str = attr.ib()
    password: str = attr.ib()
    first_name: str = attr.ib()
    last_name: str = attr.ib()
    email: str = attr.ib()
    roles: List[str] = attr.ib(default=attr.Factory(list))


@attr.s(frozen=True)
class UserUpdateRequest(UserRequest):
    new_password: str = attr.ib(default='')
