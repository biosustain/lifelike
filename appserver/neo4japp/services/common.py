from sqlalchemy.exc import SQLAlchemyError


class GraphBaseDao:
    def __init__(self, graph, **kwargs):
        # TODO LL-2916: Should rename this to neo4j_session or something similar.
        # Also, use the correct typing.
        self.graph = graph
        super().__init__(**kwargs)


class RDBMSBaseDao:
    def __init__(self, session, **kwargs):
        self.session = session
        super().__init__(**kwargs)

    def exists(self, query) -> bool:
        return self.session.query(query.exists()).scalar()

    def commit(self):
        try:
            self.session.commit()
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def commit_or_flush(self, commit_now=True):
        if commit_now:
            self.commit()
        else:
            self.session.flush()


class HybridDBDao(GraphBaseDao, RDBMSBaseDao):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
