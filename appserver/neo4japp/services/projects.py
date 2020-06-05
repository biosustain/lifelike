from sqlalchemy import and_
from sqlalchemy.orm.session import Session
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import (
    AppUser,
    AppRole,
    Directory,
    Projects,
    projects_collaborator_role,

)
from typing import Sequence


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def create_projects(self, user: AppUser, projects: Projects) -> Projects:
        self.session.add(projects)
        self.session.flush()

        # Create a default directory for every project
        default_dir = Directory(name='/', directory_parent_id=None, projects_id=projects.id)

        self.session.add(default_dir)
        self.session.flush()

        # Set default ownership
        proj_admin_role = AppRole.query.filter(AppRole.name == 'project-admin').one()
        self.add_role(user, proj_admin_role, projects)

        return projects

    def add_role(self, user: AppUser, role: AppRole, projects: Projects):
        """ Grants access to a project """
        existing_role = self.session.execute(
            projects_collaborator_role.select().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                )
            )
        ).fetchone()

        # Removes existing role if it exists
        if existing_role and existing_role != role:
            self.delete_role(user, role, projects)

        self.session.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=user.id,
                app_role_id=role.id,
                projects_id=projects.id,
            )]
        )

        self.session.commit()

    def delete_role(self, user: AppUser, role: AppRole, projects: Projects):
        """ Delete role to project """
        self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                )
            )
        )
        self.session.commit()

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

    def get_root_dir(self, projects: Projects) -> Directory:
        """ Gets the root directory
        e.g. /home/child1

        Will return '/' as the root directory
        """
        root_dirs = self.session.query(Directory).filter(
            and_(
                Directory.directory_parent_id.is_(None),
                Directory.projects_id == projects.id,
            )
        ).one()
        return root_dirs
