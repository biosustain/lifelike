from typing import Sequence, Optional

from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from neo4japp.exceptions import (
    NameUnavailableError,
)
from neo4japp.models import (
    AppUser,
    AppRole,
    Projects,
    projects_collaborator_role,
)
from neo4japp.services.common import RDBMSBaseDao


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def projects_users_have_access_2(self, user: AppUser) -> Sequence[Projects]:
        """ Return list a of projects that user either has collab rights to
            or owns it
        """
        proj_collab_roles = self.session.execute(
            projects_collaborator_role.select().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                )
            )
        ).fetchall()

        projects = []
        for p_c_r in proj_collab_roles:
            user_id, role_id, proj_id = p_c_r
            proj = Projects.query.get(proj_id)
            projects.append(proj)

        return projects

    def create_projects(self, user: AppUser, projects: Projects) -> Projects:
        try:
            self.session.add(projects)
            self.session.flush()
        except IntegrityError as e:
            raise NameUnavailableError('Unable to create projects.')

        # Create a default directory for every project
        default_dir = Directory(
            name='/',
            directory_parent_id=None,
            projects_id=projects.id,
            user_id=user.id,
        )

        self.session.add(default_dir)
        self.session.flush()

        # Set default ownership
        proj_admin_role = AppRole.query.filter(AppRole.name == 'project-admin').one()
        self.add_collaborator(user, proj_admin_role, projects)

        self.session.commit()

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
            [{
                'appuser_id': user.id,
                'app_role_id': role.id,
                'projects_id': projects.id,
            }]
        )

        self.session.commit()

    def edit_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        self.remove_collaborator(user, projects)
        self.add_collaborator(user, role, projects)

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

        self.session.commit()

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
