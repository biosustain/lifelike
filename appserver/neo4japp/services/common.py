from sqlalchemy.orm.session import Session
from sqlalchemy.exc import SQLAlchemyError
from neo4japp.exceptions import DatabaseError


class GraphBaseDao():
    def __init__(self, graph):
        self.graph = graph


class RDBMSBaseDao():
    def __init__(self, session: Session):
        self.session = session

    def exists(self, query) -> bool:
        return self.session.query(query.exists()).scalar()

    def commit(self):
        try:
            self.session.commit()
        except SQLAlchemyError as err:
            self.session.rollback()
            raise DatabaseError(str(err))

    def commit_or_flush(self, commit_now=True):
        if commit_now:
            self.commit()
        else:
            self.session.flush()
