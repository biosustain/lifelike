from sqlalchemy import and_
from sqlalchemy.orm.session import Session
from neo4japp.exceptions import DuplicateRecord
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import (
    AppUser,
    AppRole,
    Directory,
    Projects,
    projects_collaborator_role,
    Files,
    Project,
)
from typing import Sequence, Optional


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
        self.add_collaborator(user, proj_admin_role, projects)

        return projects

    def has_role(self, user: AppUser, projects: Projects) -> Optional[AppRole]:
        user_role = Projects.query_project_roles(user.id, projects.id).one_or_none()
        return user_role

    def add_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        """ Add a collaborator to a project or modify existing role """
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
            self._remove_role(user, role, projects)

        self.session.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=user.id,
                app_role_id=role.id,
                projects_id=projects.id,
            )]
        )

        self.session.commit()

    def remove_collaborator(self, user: AppUser, projects: Projects):
        """ Removes a collaborator """
        self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                )
            )
        )

    def _remove_role(self, user: AppUser, role: AppRole, projects: Projects):
        """ Remove a role """
        self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                    projects_collaborator_role.c.app_role_id == role.id,
                )
            )
        )
        self.session.commit()

    def add_directory(
            self, projects: Projects, dir_name: str, ***ARANGO_USERNAME***_dir: Directory = None) -> Directory:
        """ Adds a directory to a project """

        # Default directory is top level
        if ***ARANGO_USERNAME***_dir is None:
            ***ARANGO_USERNAME***_dir = self.get_***ARANGO_USERNAME***_dir(projects)

        existing_dirs = self.get_all_child_dirs(projects, ***ARANGO_USERNAME***_dir)
        if dir_name in [d.name for d in existing_dirs]:
            raise DuplicateRecord(f'{dir_name} already exists')

        new_dir = Directory(name=dir_name, directory_parent_id=***ARANGO_USERNAME***_dir.id, projects_id=projects.id)
        self.session.add(new_dir)
        self.session.commit()
        return new_dir

    def delete_directory(self):
        # TODO: Should we 'soft' delete or 'hard delete?'
        # This is so users don't lose ALL of their data
        # How will the cascade work?
        raise NotImplementedError()

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
