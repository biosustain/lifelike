from sqlalchemy import and_
from sqlalchemy.orm.session import Session
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import Directory, Projects


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def get_dir(self, session, projects: Projects, path: str) -> Directory:
        pass

    def get_root_dirs(self, session, projects: Projects) -> Directory:
        root_dirs = session.query(Directory).filter(
            and_(
                Directory.directory_parent_id.is_(None),
                Directory.projects_id == projects.id,
            )
        ).all()  # TODO: paginate
        return root_dirs
