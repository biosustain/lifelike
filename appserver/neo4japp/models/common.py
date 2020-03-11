import sqlalchemy as sa

from neo4japp.database import db
from neo4japp.util import snake_to_camel, camel_to_snake


class NEO4JBase():
    """ Base class for all neo4j related ORM """
    def to_dict(self, keyfn=None):
        d = self.__dict__
        keyfn = keyfn or snake_to_camel
        retval = {}
        for k in d:
            key = keyfn(k)
            retval[key] = d[k]
        return retval

    @classmethod
    def from_dict(cls, d, keyfn=None):
        keyfn = keyfn or camel_to_snake
        retval = {}
        for k in d:
            retval[keyfn(k)] = d[k]
        return cls(**retval)


class RDBMSBase(db.Model):
    """ Base class for RDBMS database (e.g. Postgres)

        An unambiguous string representation of this object.
        In the form of <class_name>#<id>.

        The string can be passed as is, or after encryption, to the
        client for the purpose of unambiguously identifying a database
        object in the system.
    """
    __abstract__ = True

    def __repr__(self) -> str:
        identifier = sa.inspect(self).identity
        pk = self.id if identifier else 'None'
        return f'{type(self).__name__}#{pk}'

    def __get_columns(self):
        return {x.name: x.type for x in sa.inspect(self).mapper.columns}
