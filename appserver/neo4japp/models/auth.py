import bcrypt

from neo4japp.database import db, ma
from neo4japp.models import RDBMSBase


class AppUser(RDBMSBase):
    """
        User models to tie ownership of resources to
    """
    __tablename__ = "appuser"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))

    def set_password(self, password):
        pwhash = bcrypt.hashpw(password.encode('utf8'), bcrypt.gensalt())
        self.password_hash = pwhash.decode('utf8')

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )


class AppUserSchema(ma.ModelSchema):
    class Meta:
        model = AppUser
