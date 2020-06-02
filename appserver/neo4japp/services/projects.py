from sqlalchemy import and_
from sqlalchemy.orm.session import Session
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import Directory, Projects


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def get_dir(self, session, projects: Projects, path: str) -> Directory:
        pass

    def get_***ARANGO_USERNAME***_dirs(self, session, projects: Projects) -> Directory:
        ***ARANGO_USERNAME***_dirs = session.query(Directory).filter(
            and_(
                Directory.directory_parent_id.is_(None),
                Directory.projects_id == projects.id,
            )
        ).all()  # TODO: paginate
        return ***ARANGO_USERNAME***_dirs
