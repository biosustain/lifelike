from sqlalchemy import and_
from sqlalchemy.orm.session import Session
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import Directory, Projects
from typing import Sequence


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def get_all_child_dirs(self, projects: Projects, current_dir: Directory) -> Sequence[Directory]:
        """ Gets all of the children and the parent, starting from the specified directory
        e.g. /home/child1/child2/child3

        Selecting home will return child1, child2, child3 and home
        """
        query = Directory.query_child_directories(current_dir.id)
        return self.session.query(query).all()

    def get_immediate_child_dirs(
            self, projects: Projects, current_dir: Directory) -> Sequence[Directory]:
        """ Gets the next child directory
        e.g. /home/child1
             /home/child2

        Selecting home will return child1 and child2
        """
        child_dirs = self.session.query(Directory).filter(
            and_(
                Directory.directory_parent_id == current_dir.id,
                Directory.projects_id == projects.id,
            )
        ).all()
        return child_dirs

    def get_***ARANGO_USERNAME***_dir(self, projects: Projects) -> Directory:
        """ Gets the ***ARANGO_USERNAME*** directory
        e.g. /home/child1

        Will return '/' as the ***ARANGO_USERNAME*** directory
        """
        ***ARANGO_USERNAME***_dirs = self.session.query(Directory).filter(
            and_(
                Directory.directory_parent_id.is_(None),
                Directory.projects_id == projects.id,
            )
        ).one()
        return ***ARANGO_USERNAME***_dirs
