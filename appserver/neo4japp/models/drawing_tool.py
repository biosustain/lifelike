import bcrypt

from neo4japp.database import db, ma

class AppUser(db.Model):
    __tablename__ = "appuser"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))

    def __repr__(self):
        return '<AppUser {}>'.format(self.username)

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


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)


class ProjectSchema(ma.ModelSchema):
    class Meta:
        model = Project