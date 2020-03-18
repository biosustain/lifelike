import bcrypt
import enum

import sqlalchemy as sa

from sqlalchemy.orm.query import Query

from neo4japp.database import db, ma
from neo4japp.models.common import RDBMSBase
from neo4japp.models.drawing_tool import Project


user_role = db.Table(
    'app_user_role',
    db.Column(
        'appuser_id',
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        primary_key=True,
    ),
    db.Column(
        'app_role_id',
        db.Integer,
        db.ForeignKey('app_role.id', ondelete='CASCADE'),
        primary_key=True,
    )
)


class AppRole(RDBMSBase):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), unique=True, nullable=False)


class AppUser(RDBMSBase):
    """
        User models to tie ownership of resources to
    """
    __tablename__ = 'appuser'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))

    # load all roles associated with the user eagerly using subquery
    roles = db.relationship(
        'AppRole',
        secondary=user_role,
        lazy='subquery',
        # create a backreference in Role named
        # `users`, but don't load them
        backref=db.backref('users', lazy=True)
    )

    def set_password(self, password):
        pwhash = bcrypt.hashpw(password.encode('utf8'), bcrypt.gensalt())
        self.password_hash = pwhash.decode('utf8')

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    @classmethod
    def query_by_email(cls, email: str) -> Query:
        return cls.query.filter(cls.email == email)

    @classmethod
    def query_by_username(cls, username: str) -> Query:
        return cls.query.filter(cls.username == username)

    def to_dict(self, exclude=None, include=None, only=None, keyfn=None):
        original_dict = super().to_dict(exclude='password_hash')
        return {
            **original_dict,
            **{'roles': [role.to_dict()['name'] for role in self.roles]}
        }

class AppUserSchema(ma.ModelSchema):
    class Meta:
        model = AppUser


class AccessRuleType(enum.Enum):
    """ Allow or Deny """
    ALLOW = 'allow'
    DENY = 'deny'


class AccessActionType(enum.Enum):
    READ = 'read'
    WRITE = 'write'


class AccessControlPolicy(RDBMSBase):
    """ Which user, group, etc have what access to protected resources """
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False)
    asset_type = db.Column(db.String(200), nullable=False)
    asset_id = db.Column(db.Integer, nullable=True)
    principal_type = db.Column(db.String(50), nullable=False)
    principal_id = db.Column(db.Integer, nullable=True)
    rule_type = db.Column(db.Enum(AccessRuleType), nullable=False)

    __table_args__ = (
        sa.Index(
            'ix_acp_asset_key',
            'asset_type',
            'asset_id',
        ),
        sa.Index(
            'ix_acp_principal_key',
            'principal_type',
            'principal_id',
        ),
    )

    @classmethod
    def query_by_user_and_project_id(
        cls,
        user_id: int,
        project_id: int,
        action: str,
    ) -> Query:
        return cls.query.filter(
            cls.action == action,
            cls.asset_type == Project.__tablename__,
            cls.asset_id == project_id,
            cls.principal_type == AppUser.__tablename__,
            cls.principal_id == user_id,
        )


class AccessControlPolicySchema(ma.ModelSchema):
    class Meta:
        model = AccessControlPolicy
