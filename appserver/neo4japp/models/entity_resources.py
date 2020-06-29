from neo4japp.database import db
from neo4japp.models.common import RDBMSBase
from sqlalchemy.orm import relationship


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
    color_id = db.Column(db.Integer, db.ForeignKey('color.id'), nullable=False)
    color = relationship('Color', back_populates='annotations', primaryjoin="User.id == Post.user_id")
    icon_code = db.Column(db.String(32), nullable=True)
    style_border_id = db.Column(db.Integer, db.ForeignKey('color.id'), nullable=True)
    style_border = relationship('Color', back_populates='annotations_border')
    style_background_id = db.Column(db.Integer, db.ForeignKey('color.id'), nullable=True)
    style_background = relationship('Color', back_populates='annotations_background')
    style_color_id = db.Column(db.Integer, db.ForeignKey('color.id'), nullable=True)
    style_color = relationship('Color', back_populates='annotations_color')

    def get_as_json(self):
        return {
            'label': self.label,
            'color': self.color.hexcode,
            'icon_code': self.icon_code,
            'style': {
                'border': self.style_border.hexcode,
                'background': self.style_background.hexcode,
                'color': self.style_color.hexcode
            }
        }


class Color(RDBMSBase):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(32), nullable=False)
    hexcode = db.Column(db.String(8), nullable=False)
