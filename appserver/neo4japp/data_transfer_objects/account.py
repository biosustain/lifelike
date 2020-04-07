import attr

from neo4japp.util import CamelDictMixin

from typing import List


@attr.s(frozen=True)
class UserCreationRequest(CamelDictMixin):
    username: str = attr.ib()
    password: str = attr.ib()
    email: str = attr.ib()
    roles: List[str] = attr.ib(default=attr.Factory(list))
