from sqlalchemy.orm.session import Session


class GraphBaseDao():
    def __init__(self, graph):
        self.graph = graph


class RDBMSBaseDao():
    def __init__(self, session: Session):
        self.session = session