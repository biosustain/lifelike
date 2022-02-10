from sqlalchemy.orm.session import Session

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models.common import RDBMSBase
from neo4japp.models.auth import (
    AppUser,
)


class AuthService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

    def has_role(
        self,
        principal: RDBMSBase,
        role: str,
    ) -> bool:
        # TODO: Add other principal types
        if isinstance(principal, AppUser):
            return role in [r.name for r in principal.roles]
        raise NotImplementedError
