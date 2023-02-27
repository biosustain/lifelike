from io import BytesIO
from typing import Sequence, Optional, Tuple, Dict, List, Union
from uuid import uuid4

from flask import current_app
from sqlalchemy import and_, asc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session

from neo4japp.constants import FILE_MIME_TYPE_MAP, FILE_MIME_TYPE_DIRECTORY, \
    MASTER_INITIAL_PROJECT_NAME
from neo4japp.database import db, get_authorization_service
from neo4japp.exceptions import ServerException
from neo4japp.models import (
    AppUser,
    AppRole,
    Projects,
    projects_collaborator_role, Files,
)
from neo4japp.models.common import generate_hash_id
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause, FileContent
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.services.file_types.providers import DirectoryTypeProvider, MapTypeProvider


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def get_accessible_projects(self, user: AppUser, filter=None) -> Sequence[Projects]:
        """ Return list a of projects that user either has collab rights to
            or owns it
        """

        t_role = aliased(AppRole)
        t_user = aliased(AppUser)

        project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
            .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
            .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
            .subquery()

        query = db.session.query(Projects) \
            .outerjoin(project_role_sq,
                       and_(project_role_sq.c.projects_id == Projects.id,
                            project_role_sq.c.appuser_id == user.id,
                            project_role_sq.c.name.in_(
                                ['project-read', 'project-write', 'project-admin'])))

        if filter:
            query = query.filter(filter)

        if not get_authorization_service().has_role(user, 'private-data-access'):
            query = query.filter(project_role_sq.c.name.isnot(None))

        return query.all()

    def create_project_uncommitted(self, user: AppUser, projects: Projects) -> Projects:
        db.session.add(projects)

        ***ARANGO_USERNAME*** = Files()
        ***ARANGO_USERNAME***.mime_type = DirectoryTypeProvider.MIME_TYPE
        ***ARANGO_USERNAME***.filename = '/'
        ***ARANGO_USERNAME***.path = f'/{projects.name}'
        ***ARANGO_USERNAME***.user = user
        ***ARANGO_USERNAME***.creator = user
        db.session.add(***ARANGO_USERNAME***)

        projects.***ARANGO_USERNAME*** = ***ARANGO_USERNAME***

        # Set default ownership
        admin_role = db.session.query(AppRole).filter(AppRole.name == 'project-admin').one()
        self.add_collaborator_uncommitted(user, admin_role, projects)

        return projects

    def create_projects(self, user: AppUser, projects: Projects) -> Projects:
        projects = self.create_project_uncommitted(user, projects)
        db.session.commit()
        # rollback in case of error?
        return projects

    def has_role(self, user: AppUser, projects: Projects) -> Optional[AppRole]:
        user_role = Projects.query_project_roles(user.id, projects.id).one_or_none()
        return user_role

    def add_collaborator_uncommitted(self, user: AppUser, role: AppRole, projects: Projects):
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

    def add_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        self.add_collaborator_uncommitted(user, role, projects)
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

    def _add_generic_file(
            self,
            master_file: Files,
            content_id: int,
            parent_id: int,
            user: AppUser,
            hash_id_map: Dict[str, str],
    ) -> Files:
        new_file = Files({
            **master_file,
            **dict(
                hash_id=hash_id_map[master_file.hash_id],
                filename=master_file.filename,
                parent_id=parent_id,
                content_id=content_id,
                user_id=user.id,
            )
        })

        db.session.add(new_file)
        db.session.flush()
        current_app.logger.info(
            f'Initial file with id {new_file.id} flushed to pending transaction. ' +
            f'User: {user.id}.'
        )

        if master_file.annotations:
            self._add_file_annotations_version(new_file, user)

        return new_file

    def _add_file_annotations_version(self, file: Files, user: AppUser):
        new_file_annotations_version = FileAnnotationsVersion(
            file_id=file.id,
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user_id=user.id
        )
        db.session.add(new_file_annotations_version)
        db.session.flush()
        current_app.logger.info(
            f'Annotations version with id {new_file_annotations_version.id} flushed to ' +
            f'pending transaction. User: {user.id}.'
        )

    def _remap_map_content(
            self,
            master_map_content: FileContent,
            hash_id_map: Dict[str, str],
            project_name_map: Dict[str, str]
    ):
        # Create initial map for this user
        mapTypeProvider = MapTypeProvider()
        map_content = BytesIO(master_map_content.raw_file)
        updated_map_content = mapTypeProvider.update_map(
            {},
            map_content,
            mapTypeProvider.links_updater(hash_id_map, project_name_map)
        )
        return FileContent().get_or_create(updated_map_content)

    def _add_project(self, user: AppUser) -> Union[Projects, None]:
        project = Projects()
        project.name = f'{user.username}-example'
        project.description = f'Initial project for {user.username}'
        try:
            db.session.begin_nested()
            self.create_project_uncommitted(user, project)
            db.session.commit()
            db.session.flush()
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.warning(
                f'Failed to create initial project with default name {project.name} for user ' +
                f'{user.username}. Will retry project creation with a unique project name.',
                exc_info=e,
            )
            project.name += '-' + uuid4().hex[:8]
            try:
                db.session.begin_nested()
                self.create_project_uncommitted(user, project)
                db.session.commit()
                db.session.flush()
            except IntegrityError as e:
                db.session.rollback()
                current_app.logger.error(
                    f'Failed to create initial project for user {user.username} with modified ' +
                    f'project name: {project.name}. See attached exception info for details.',
                    exc_info=e
                )
                # If we couldn't create and add the project, then return None
                return None
        return project

    def _get_all_master_project_files(self) -> List[Files]:
        master_initial_***ARANGO_USERNAME***_folder = db.session.query(
            Files
        ).join(
            Projects,
            and_(
                Projects.***ARANGO_USERNAME***_id == Files.id,
                Projects.name == MASTER_INITIAL_PROJECT_NAME
            )
        ).one()

        return db.session.query(
            Files
        ).filter(
            Files.path.startswith(master_initial_***ARANGO_USERNAME***_folder.path)
        ).order_by(
            asc(Files.path)
        ).all()

    def _copy_master_files(
            self,
            new_project: Projects,
            user: AppUser
    ):
        master_files = self._get_all_master_project_files()

        # Pre-calculate hash ids for all files so we can update the new maps with the new hash ids
        file_hash_id_map = {file.hash_id: generate_hash_id() for file in master_files}

        # Assume ***ARANGO_USERNAME*** folder is always first in the list since we order by path
        master_***ARANGO_USERNAME***_folder = master_files.pop(0)
        master_folder_stack = [master_***ARANGO_USERNAME***_folder.id]
        new_folder_stack = [new_project.***ARANGO_USERNAME***_id]

        # Note that at this point, everything EXCEPT the ***ARANGO_USERNAME*** folder is in this list!
        for master_file in master_files:
            # If we've moved past a folder's last child, cutoff that path
            if master_file.parent_id != master_folder_stack[-1]:
                cutoff = master_folder_stack.index(master_file.parent_id)
                master_folder_stack = master_folder_stack[:cutoff + 1]  # Include the cutoff index
                new_folder_stack = new_folder_stack[:cutoff + 1]

            content_id = master_file.content_id

            # If this file is map we need to update internal links
            if master_file.mime_type == FILE_MIME_TYPE_MAP:
                content_id = self._remap_map_content(
                    master_file.content,
                    file_hash_id_map,
                    {}
                )

            new_file = self._add_generic_file(
                master_file,
                content_id,
                new_folder_stack[-1],
                user,
                file_hash_id_map,
            )

            # If this file is a folder, then add it to the stacks
            if master_file.mime_type == FILE_MIME_TYPE_DIRECTORY:
                master_folder_stack.append(master_file.id)
                new_folder_stack.append(new_file.id)

    def create_initial_project(self, user: AppUser):
        """
        Create a initial project for the user.
        :param user: user to create initial project for
        """
        new_project = self._add_project(user)
        if new_project is not None:
            self._copy_master_files(new_project, user)
        else:
            raise ServerException(
                title='User Initial Project Creation Error',
                message=f'There was an issue creating the initial project for the user.',
                fields={
                    'user_id': user.id,
                    'username': user.username,
                    'user_email': user.email
                },
            )
