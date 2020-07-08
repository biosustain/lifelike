from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class DomainULRsMap(RDBMSBase):
    """
    This model stores the relation between knowledge domains and its base URLs
    """
    id = db.Column(db.Integer, primary_key=True)
    domain = db.Column(db.String(128), nullable=False)
    base_URL = db.Column(db.String(256), nullable=False)


class AnnotationStyle(RDBMSBase):
    """
    This model stores the styles related to each entity type
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(32), nullable=False)
    color = db.Column(db.String(9), nullable=False)
    icon_code = db.Column(db.String(32), nullable=True)
    style_border = db.Column(db.String(9), nullable=True)
    style_background = db.Column(db.String(9), nullable=True)
    style_color = db.Column(db.String(9), nullable=True)

    def get_as_json(self):
        return {
            'label': self.label,
            'color': self.color,
            'icon_code': self.icon_code,
            'style': {
                'border': self.style_border,
                'background': self.style_background,
                'color': self.style_color
            }
        }
