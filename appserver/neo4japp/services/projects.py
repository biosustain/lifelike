from datetime import datetime
from flask import current_app
from io import BytesIO
import re
from sqlalchemy import and_, asc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session
from typing import Dict, List, Optional, Sequence, Union
from uuid import uuid4

from neo4japp.constants import (
    FILE_MIME_TYPE_BIOC,
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_ENRICHMENT_TABLE,
    FILE_MIME_TYPE_GRAPH,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_PDF,
    MASTER_INITIAL_PROJECT_NAME,
    TIMEZONE,
)
from neo4japp.database import db, get_authorization_service
from neo4japp.exceptions import ServerException
from neo4japp.models.auth import AppRole, AppUser
from neo4japp.models.common import generate_hash_id
from neo4japp.models.files import (
    AnnotationChangeCause,
    Files,
    FileContent,
    FileAnnotationsVersion,
)
from neo4japp.models.projects import projects_collaborator_role, Projects
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
        master_file_content_id: int,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str],
        **kwargs
    ) -> Files:
        new_file = Files(
            hash_id=hash_id_map[master_file.hash_id],
            filename=master_file.filename,
            parent_id=parent_id,
            content_id=master_file_content_id,
            user_id=user.id,
            public=False,
            pinned=False,
            path=f'/{project.name}/{master_file.filename}',
            description=master_file.description,
            # First we add the properties shared by all files, then leave room for any file-type
            # specific properties
            **kwargs
        )
        db.session.add(new_file)
        db.session.flush()
        current_app.logger.info(
            f'Initial file with id {new_file.id} flushed to pending transaction. ' +
            f'User: {user.id}.'
        )
        return new_file

    def _add_file_annotations_version(self, file: Files, user: AppUser):
        new_file_annotations_version = FileAnnotationsVersion(
            file_id=file.id,
            hash_id=str(uuid4()),
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

    def _add_annotatable_file(
        self,
        master_file: Files,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str],
        mime_type: str
    ):
        new_file = self._add_generic_file(
            master_file,
            master_file.content_id,
            project,
            parent_id,
            user,
            hash_id_map,
            mime_type=mime_type,
            annotations=master_file.annotations,
            annotations_date=datetime.now(TIMEZONE),
            annotation_configs=master_file.annotation_configs,
            organism_name=master_file.organism_name,
            organism_synonym=master_file.organism_synonym,
            organism_taxonomy_id=master_file.organism_taxonomy_id,
        )
        self._add_file_annotations_version(new_file, user)

    def _add_map(
        self,
        master_map: Files,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str]
    ):
        def update_map_links(map_json):
            new_link_re = r'^\/projects\/([^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
            for node in map_json['nodes']:
                for source in node['data'].get('sources', []):
                    link_search = re.search(new_link_re, source['url'])
                    if link_search is not None:
                        project_name = link_search.group(1)
                        hash_id = link_search.group(2)
                        if hash_id in hash_id_map:
                            source['url'] = source['url'].replace(
                                project_name,
                                project.name
                            ).replace(
                                hash_id,
                                hash_id_map[hash_id]
                            )

            for edge in map_json['edges']:
                if 'data' in edge:
                    for source in edge['data'].get('sources', []):
                        link_search = re.search(new_link_re, source['url'])
                        if link_search is not None:
                            project_name = link_search.group(1)
                            hash_id = link_search.group(2)
                            if hash_id in hash_id_map:
                                source['url'] = source['url'].replace(
                                    project_name,
                                    project.name
                                ).replace(
                                    hash_id,
                                    hash_id_map[hash_id]
                                )

            return map_json

        # Create initial map for this user
        mapTypeProvider = MapTypeProvider()
        map_content = BytesIO(master_map.content.raw_file)
        updated_map_content = mapTypeProvider.update_map(
            {},
            map_content,
            update_map_links
        )
        map_content_id = FileContent().get_or_create(updated_map_content)
        self._add_generic_file(
            master_map,
            map_content_id,
            project,
            parent_id,
            user,
            hash_id_map,
            mime_type=FILE_MIME_TYPE_MAP,
        )

    def _add_sankey(
        self,
        master_sankey: Files,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str]
    ):
        self._add_generic_file(
            master_sankey,
            master_sankey.content_id,
            project,
            parent_id,
            user,
            hash_id_map,
            mime_type=FILE_MIME_TYPE_GRAPH,
        )

    def _add_bioc(
        self,
        master_bioc: Files,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str]
    ):
        self._add_generic_file(
            master_bioc,
            master_bioc.content_id,
            project,
            parent_id,
            user,
            hash_id_map,
            mime_type=FILE_MIME_TYPE_BIOC,
            # Very important that DOI is copied over!
            doi=master_bioc.doi
        )

    def _add_folder(
        self,
        master_folder: Files,
        project: Projects,
        parent_id: int,
        user: AppUser,
        hash_id_map: Dict[str, str]
    ) -> int:
        new_folder = self._add_generic_file(
            master_folder,
            None,
            project,
            parent_id,
            user,
            hash_id_map,
            mime_type=FILE_MIME_TYPE_DIRECTORY,
        )
        return new_folder.id

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
                project = None
        finally:
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

            # If this file is a folder itself, then first create a copy and add it to the stacks
            if master_file.mime_type == FILE_MIME_TYPE_DIRECTORY:
                new_folder = self._add_folder(
                    master_file,
                    new_project,
                    new_folder_stack[-1],
                    user,
                    file_hash_id_map
                )
                master_folder_stack.append(master_file.id)
                new_folder_stack.append(new_folder)
            elif master_file.mime_type == FILE_MIME_TYPE_MAP:
                self._add_map(
                    master_file,
                    new_project,
                    new_folder_stack[-1],
                    user,
                    file_hash_id_map
                )
            elif master_file.mime_type in [FILE_MIME_TYPE_PDF, FILE_MIME_TYPE_ENRICHMENT_TABLE]:
                self._add_annotatable_file(
                    master_file,
                    new_project,
                    new_folder_stack[-1],
                    user,
                    file_hash_id_map,
                    master_file.mime_type
                )
            elif master_file.mime_type == FILE_MIME_TYPE_GRAPH:
                self._add_sankey(
                    master_file,
                    new_project,
                    new_folder_stack[-1],
                    user,
                    file_hash_id_map
                )
            elif master_file.mime_type == FILE_MIME_TYPE_BIOC:
                self._add_bioc(
                    master_file,
                    new_project,
                    new_folder_stack[-1],
                    user,
                    file_hash_id_map
                )


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
