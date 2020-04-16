from neo4japp.database import db


class Projects(db.Model):  # type: ignore
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    users = db.Column(db.ARRAY(db.Integer), nullable=False)
