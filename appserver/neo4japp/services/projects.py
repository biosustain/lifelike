import re
from typing import Dict, List, Optional, Sequence, Union
from uuid import uuid4

from flask import current_app
from sqlalchemy import and_, asc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session

from neo4japp.constants import (
    FILE_MIME_TYPE_MAP,
    MASTER_INITIAL_PROJECT_NAME,
)
from neo4japp.database import db, get_authorization_service
from neo4japp.exceptions import ServerException
from neo4japp.models.auth import AppRole, AppUser
from neo4japp.models.common import generate_hash_id
from neo4japp.models.files import (
    AnnotationChangeCause,
    FileAnnotationsVersion,
    FileContent,
    Files,
)
from neo4japp.models.projects import Projects, projects_collaborator_role
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.services.file_types.providers import (
    DirectoryTypeProvider,
    MapTypeProvider,
)
from neo4japp.utils.file_content_buffer import FileContentBuffer


class ProjectsService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

    def get_accessible_projects(self, user: AppUser, filter=None) -> Sequence[Projects]:
        """Return list a of projects that user either has collab rights to
        or owns it
        """

        t_role = aliased(AppRole)
        t_user = aliased(AppUser)

        project_role_sq = (
            db.session.query(projects_collaborator_role, t_role.name)
            .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id)
            .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id)
            .subquery()
        )

        query = db.session.query(Projects).outerjoin(
            project_role_sq,
            and_(
                project_role_sq.c.projects_id == Projects.id,
                project_role_sq.c.appuser_id == user.id,
                project_role_sq.c.name.in_(
                    ['project-read', 'project-write', 'project-admin']
                ),
            ),
        )

        if filter:
            query = query.filter(filter)

        if not get_authorization_service().has_role(user, 'private-data-access'):
            query = query.filter(project_role_sq.c.name.isnot(None))

        return query.all()

    def create_project(self, user: AppUser, projects: Projects) -> Projects:
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
        admin_role = (
            db.session.query(AppRole).filter(AppRole.name == 'project-admin').one()
        )
        self.add_collaborator_uncommitted(user, admin_role, projects)

        return projects

    def create_projects(self, user: AppUser, projects: Projects) -> Projects:
        return self.create_project(user, projects)

    def has_role(self, user: AppUser, projects: Projects) -> Optional[AppRole]:
        user_role = Projects.query_project_roles(user.id, projects.id).one_or_none()
        return user_role

    def add_collaborator_uncommitted(
        self, user: AppUser, role: AppRole, projects: Projects
    ):
        """Add a collaborator to a project or modify existing role"""
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
            [
                {
                    'appuser_id': user.id,
                    'app_role_id': role.id,
                    'projects_id': projects.id,
                }
            ],
        )

    def add_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        return self.add_collaborator_uncommitted(user, role, projects)

    def edit_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        self.remove_collaborator(user, projects)
        return self.add_collaborator(user, role, projects)

    def remove_collaborator(self, user: AppUser, projects: Projects):
        """Removes a collaborator"""
        return self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                )
            )
        )

    def _remove_role(self, user: AppUser, role: AppRole, projects: Projects):
        """Remove a role"""
        return self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                    projects_collaborator_role.c.app_role_id == role.id,
                )
            )
        )

    def _copy_generic_file(
        self,
        master_file: Files,
        content: FileContent,
        parent: Files,
        hash_id_map: Dict[str, str],
    ) -> Files:
        new_file = Files(
            **master_file.to_dict(
                exclude={
                    'id',
                    'hash_id',
                    'parent_id',
                    'content_id',
                    'public',
                    'pinned',
                },
                keyfn=lambda k: k,
            ),
            hash_id=hash_id_map[master_file.hash_id],
            parent=parent,
            content=content,
            public=False,
            pinned=False,
        )
        db.session.add(new_file)
        current_app.logger.info(f'Coppied file: {new_file.hash_id}')

        if master_file.annotations:
            self._add_file_annotations_version(new_file)

        return new_file

    def _add_file_annotations_version(self, file: Files):
        new_annotations_version = FileAnnotationsVersion(
            file=file,
            hash_id=str(uuid4()),
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user=file.user,
        )
        db.session.add(new_annotations_version)
        current_app.logger.info(
            f'Added annotations version: {new_annotations_version.hash_id}'
        )

    def _add_map(
        self,
        master_map: Files,
        parent: Files,
        hash_id_map: Dict[str, str],
        project: Optional[Projects],
    ):
        def update_map_links(map_json):
            new_link_re = r'^\/projects\/([^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'

            def update_sources(data):
                for source in data.get('sources', []):
                    link_search = re.search(new_link_re, source['url'])
                    if link_search is not None:
                        project_name = link_search.group(1)
                        hash_id = link_search.group(2)
                        if hash_id in hash_id_map:
                            if project:
                                source['url'] = source['url'].replace(
                                    project_name, project.name
                                )
                            source['url'] = source['url'].replace(
                                hash_id, hash_id_map[hash_id]
                            )

            for node in map_json['nodes']:
                update_sources(node['data'])

            for edge in map_json['edges']:
                if 'data' in edge:
                    update_sources(edge['data'])

            return map_json

        # Create initial map for this user
        mapTypeProvider = MapTypeProvider()
        map_content_buffer = FileContentBuffer(master_map.content.raw_file)
        updated_map_content_buffer = mapTypeProvider.update_map(
            {}, map_content_buffer, update_map_links
        )
        map_content = FileContent().get_or_create(updated_map_content_buffer)
        return self._copy_generic_file(
            master_map,
            map_content,
            parent,
            hash_id_map,
        )

    def _add_project(self, user: AppUser) -> Union[Projects, None]:
        project = Projects()
        project.name = f'{user.username}-example'
        project.description = f'Initial project for {user.username}'
        try:
            with db.session.begin_nested():
                self.create_project(user, project)
        except IntegrityError as e:
            current_app.logger.warning(
                f'Failed to create initial project with default name {project.name} for user '
                + f'{user.username}. Will retry project creation with a unique project name.',
                exc_info=e,
            )
            project.name += '-' + uuid4().hex[:8]
            try:
                with db.session.begin_nested():
                    self.create_project(user, project)
            except IntegrityError as e:
                current_app.logger.error(
                    f'Failed to create initial project for user {user.username} with modified '
                    + f'project name: {project.name}. See attached exception info for details.',
                    exc_info=e,
                )
                # If we couldn't create and add the project, then return None
                return None
        return project

    def _get_initial_project_***ARANGO_USERNAME***(self) -> Files:
        return (
            db.session.query(Files)
            .join(
                Projects,
                and_(
                    Projects.***ARANGO_USERNAME***_id == Files.id,
                    Projects.name == MASTER_INITIAL_PROJECT_NAME,
                ),
            )
            .one()
        )

    def _get_folder_flattern_hierarchy(self, folder: Files) -> List[Files]:
        return (
            db.session.query(Files)
            .filter(
                and_(Files.path.startswith(folder.path), Files.deletion_date.is_(None))
            )
            .order_by(asc(Files.path))
            .all()
        )

    def _copy_master_files(self, new_project: Projects, user: AppUser):
        initial_project_***ARANGO_USERNAME*** = self._get_initial_project_***ARANGO_USERNAME***()

        copied_file_map = self._copy_folder_content(
            initial_project_***ARANGO_USERNAME***, new_project.***ARANGO_USERNAME***
        )

        for file in copied_file_map.values():
            file.user = user
            for version in file.annotations_versions:
                version.user = user

    def _copy_folder_content(
        self,
        source_folder: Files,
        target_folder: Files,
        *,
        target_project: Projects = None,
    ):
        files = self._get_folder_flatten_hierarchy(source_folder)

        # Pre-calculate hash ids for all files so we can update the new maps with the new hash ids
        file_hash_id_map = {file.hash_id: generate_hash_id() for file in files}

        # Assume source_folder folder is always first in the list since we order by path
        source_folder = files.pop(0)
        copy_map = {source_folder.id: target_folder}

        # Note that at this point, everything EXCEPT the ***ARANGO_USERNAME*** folder is in this list!
        for file in files:
            parent = copy_map[file.parent_id]

            if file.mime_type == FILE_MIME_TYPE_MAP:
                new_file = self._add_map(file, parent, file_hash_id_map, target_project)
            else:
                new_file = self._copy_generic_file(
                    file,
                    file.content,
                    parent,
                    file_hash_id_map,
                )

            copy_map[file.id] = new_file

        return copy_map

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
                    'user_email': user.email,
                },
            )
