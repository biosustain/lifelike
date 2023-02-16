from datetime import datetime
from flask import current_app
from io import BytesIO
import re
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session
from typing import Sequence, Optional, Union
from uuid import uuid4

from neo4japp.constants import (
    FILE_MIME_TYPE_ENRICHMENT_TABLE,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_PDF,
    TIMEZONE,
)
from neo4japp.database import db, get_authorization_service
from neo4japp.models.auth import AppRole, AppUser
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

        root = Files()
        root.mime_type = DirectoryTypeProvider.MIME_TYPE
        root.filename = '/'
        root.path = f'/{projects.name}'
        root.user = user
        root.creator = user
        db.session.add(root)

        projects.root = root

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


    def _add_initial_pdf(
        self,
        master_initial_pdf: Files,
        initial_project: Projects,
        user: AppUser
    ) -> Files:
        new_pdf_file = Files(
            hash_id=str(uuid4()),
            filename=master_initial_pdf.filename,
            parent_id=initial_project.root_id,
            mime_type=FILE_MIME_TYPE_PDF,
            content_id=master_initial_pdf.content_id,
            user_id=user.id,
            public=False,
            pinned=False,
            path=f'{initial_project.name}/{master_initial_pdf.filename}',
            description=master_initial_pdf.description,
            annotations=master_initial_pdf.annotations,
            annotations_date=datetime.now(TIMEZONE),
            annotation_configs=master_initial_pdf.annotation_configs,
            organism_name=master_initial_pdf.organism_name,
            organism_synonym=master_initial_pdf.organism_synonym,
            organism_taxonomy_id=master_initial_pdf.organism_taxonomy_id,
        )
        db.session.add(new_pdf_file)
        db.session.flush()
        current_app.logger.info(
            f'Initial PDF with id {new_pdf_file.id} flushed to pending transaction. ' +
            f'User: {user.id}.'
        )

        new_pdf_file_annotations_version = FileAnnotationsVersion(
            file_id=new_pdf_file.id,
            hash_id=str(uuid4()),
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user_id=user.id
        )
        db.session.add(new_pdf_file_annotations_version)
        db.session.flush()
        current_app.logger.info(
            f'PDF annotations version with id {new_pdf_file_annotations_version.id} flushed to ' +
            f'pending transaction. User: {user.id}.'
        )
        return new_pdf_file


    def _add_initial_enrichment(
        self,
        master_initial_et: Files,
        initial_project: Projects,
        user: AppUser
    ):
        new_et_file = Files(
            hash_id=str(uuid4()),
            filename=master_initial_et.filename,
            parent_id=initial_project.root_id,
            mime_type=FILE_MIME_TYPE_ENRICHMENT_TABLE,
            content_id=master_initial_et.content_id,
            user_id=user.id,
            public=False,
            pinned=False,
            path=f'{initial_project.name}/{master_initial_et.filename}',
            description=master_initial_et.description,
            annotations=master_initial_et.annotations,
            enrichment_annotations=master_initial_et.enrichment_annotations,
            annotations_date=datetime.now(TIMEZONE),
            annotation_configs=master_initial_et.annotation_configs,
            organism_name=master_initial_et.organism_name,
            organism_synonym=master_initial_et.organism_synonym,
            organism_taxonomy_id=master_initial_et.organism_taxonomy_id,
        )
        db.session.add(new_et_file)
        db.session.flush()
        current_app.logger.info(
            f'Initial enrichment table with id {new_et_file.id} flushed to pending transaction. ' +
            f'User: {user.id}.'
        )

        new_et_file_annotations_version = FileAnnotationsVersion(
            file_id=new_et_file.id,
            hash_id=str(uuid4()),
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user_id=user.id
        )
        db.session.add(new_et_file_annotations_version)
        db.session.flush()
        current_app.logger.info(
            f'PDF annotations version with id {new_et_file_annotations_version.id} flushed to ' +
            f'pending transaction. User: {user.id}.'
        )


    def _add_initial_map(
        self,
        master_initial_map: Files,
        master_initial_pdf: Files,
        new_pdf_file: Files,
        project: Projects,
        user: AppUser
    ):
        def update_map_links(map_json):
            new_link_re = r'^\/projects\/([^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
            for node in map_json['nodes']:
                for source in node['data'].get('sources', []):
                    link_search = re.search(new_link_re, source['url'])
                    if link_search is not None:
                        project_name = link_search.group(1)
                        hash_id = link_search.group(2)
                        if hash_id in master_initial_pdf.hash_id:
                            source['url'] = source['url'].replace(
                                project_name,
                                project.name
                            ).replace(
                                hash_id,
                                new_pdf_file.hash_id
                            )

            for edge in map_json['edges']:
                if 'data' in edge:
                    for source in edge['data'].get('sources', []):
                        link_search = re.search(new_link_re, source['url'])
                        if link_search is not None:
                            project_name = link_search.group(1)
                            hash_id = link_search.group(2)
                            if hash_id in master_initial_pdf.hash_id:
                                source['url'] = source['url'].replace(
                                    project_name,
                                    project.name
                                ).replace(
                                    hash_id,
                                    new_pdf_file.hash_id
                                )

            return map_json

        # Create initial map for this user
        mapTypeProvider = MapTypeProvider()
        map_content = BytesIO(master_initial_map.content.raw_file)
        updated_map_content = mapTypeProvider.update_map(
            {},
            map_content,
            update_map_links
        )
        map_content_id = FileContent().get_or_create(updated_map_content)
        new_map_file = Files(
            hash_id=str(uuid4()),
            filename=master_initial_map.filename,
            parent_id=project.root_id,
            mime_type=FILE_MIME_TYPE_MAP,
            content_id=map_content_id,
            user_id=user.id,
            public=False,
            pinned=False,
            path=f'{project.name}/{master_initial_map.filename}',
        )
        db.session.add(new_map_file)
        db.session.flush()
        current_app.logger.info(
            f'Initial map with id {new_map_file.id} flushed to pending transaction. ' +
            f'User: {user.id}.'
        )


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
        else:
            return project


    def create_initial_project(self, user: AppUser):
        """
        Create a initial project for the user.
        This method is designed to fail siletly if the project name already exists
        or if initial project template does not exist.
        :param user: user to create initial project for
        """

        new_project = self._add_project(user)

        # Create the initial pdf
        master_initial_pdf = db.session.query(
            Files
        ).filter(
            and_(
                Files.path.startswith('/master-initial-project/'),
                Files.mime_type == FILE_MIME_TYPE_PDF
            )
        ).one()
        new_pdf_file = self._add_initial_pdf(master_initial_pdf, new_project, user)

        # Create the initial enrichment table
        master_initial_et = db.session.query(
            Files
        ).filter(
            and_(
                Files.path.startswith('/master-initial-project/'),
                Files.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE
            )
        ).one()
        self._add_initial_enrichment(master_initial_et, new_project, user)

        # Create the initial map
        master_initial_map = db.session.query(
            Files
        ).filter(
            and_(
                Files.path.startswith('/master-initial-project/'),
                Files.mime_type == FILE_MIME_TYPE_MAP
            )
        ).one()
        self._add_initial_map(
            master_initial_map,
            master_initial_pdf,
            new_pdf_file,
            new_project,
            user
        )
