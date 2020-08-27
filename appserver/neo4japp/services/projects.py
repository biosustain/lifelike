from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session
from neo4japp.exceptions import (
    DirectoryError,
    DuplicateRecord, NameUnavailableError,
)
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
from neo4japp.util import AttrDict
from typing import Sequence, Optional, Union, Tuple


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
            [dict(
                appuser_id=user.id,
                app_role_id=role.id,
                projects_id=projects.id,
            )]
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

    def add_directory(
            self, projects: Projects, dir_name: str,
            user: AppUser, ***ARANGO_USERNAME***_dir: Directory = None) -> Directory:
        """ Adds a directory to a project """

        # Default directory is top level
        if ***ARANGO_USERNAME***_dir is None:
            ***ARANGO_USERNAME***_dir = self.get_***ARANGO_USERNAME***_dir(projects)

        existing_dirs = self.get_all_child_dirs(projects, ***ARANGO_USERNAME***_dir)
        if dir_name in [d.name for d in existing_dirs]:
            raise DuplicateRecord(f'{dir_name} already exists')

        new_dir = Directory(
            name=dir_name, directory_parent_id=***ARANGO_USERNAME***_dir.id, projects_id=projects.id, user_id=user.id
        )
        self.session.add(new_dir)
        self.session.commit()
        return new_dir

    def delete_directory(self, dir: Directory):
        # Check if directory is empty before allowing deletes
        files = self.session.query(Files.query.filter(Files.dir_id == dir.id).exists()).scalar()
        maps = self.session.query(Project.query.filter(Project.dir_id == dir.id).exists()).scalar()
        nested_dirs = self.session.query(
            Directory.query.filter(Directory.directory_parent_id == dir.id).exists()).scalar()
        if any([files, maps, nested_dirs]):
            raise DirectoryError('Cannot delete non-empty directory')
        elif dir.directory_parent_id is None:
            raise DirectoryError('Cannot delete ***ARANGO_USERNAME*** directory')
        self.session.delete(dir)
        self.session.commit()

    def rename_directory(self, new_name: str, dir: Directory) -> Directory:
        setattr(dir, 'name', new_name)
        self.session.add(dir)
        self.session.commit()
        return dir

    def move_directory(self, origin_dir: Directory, dest: Directory) -> Directory:
        """ Moves directory within the same project """
        if origin_dir.projects_id != dest.projects_id:
            raise DirectoryError('Cannot move directory into a different project')
        setattr(origin_dir, 'directory_parent_id', dest.id)
        self.session.add(origin_dir)
        self.session.commit()
        return dest

    def move_pdf(self, pdf: Files, dest: Directory) -> Directory:
        """ Moves pdf within the same project """
        curr_file_dir = Directory.query.get(pdf.dir_id)
        if curr_file_dir.projects_id != dest.projects_id:
            raise DirectoryError('Cannot move pdf into a different project')
        setattr(pdf, 'dir_id', dest.id)
        self.session.add(curr_file_dir)
        self.session.commit()
        return dest

    def move_map(self, drawing_map: Project, dest: Directory) -> Directory:
        """ Moves map within the same project """
        curr_map_dir = Directory.query.get(drawing_map.dir_id)
        if curr_map_dir.projects_id != dest.projects_id:
            raise DirectoryError('Cannot move map into a different project')
        setattr(drawing_map, 'dir_id', dest.id)
        self.session.add(curr_map_dir)
        self.session.commit()
        return dest

    def get_all_child_dirs(self, projects: Projects, current_dir: Directory) -> Sequence[Directory]:
        """ Gets all of the children and the parent, starting from the specified directory
        e.g. /home/child1/child2/child3

        Selecting home will return child1, child2, child3 and home
        """
        query = Directory.query_child_directories(current_dir.id)
        return self.session.query(query).all()

    def get_absolute_dir_path(
            self, projects: Projects, current_dir: Directory) -> Sequence[Directory]:
        """Gets the absolute path from the current directory
        e.g. /home/child1/child1a

        If we start at child1, we get child1a, child1, home
        """
        query = Directory.query_absolute_dir_path(current_dir.id)
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

    def get_dir_content(
        self,
        projects: Projects,
        current_dir: Directory
    ) -> Tuple[
            Sequence[Tuple[Directory, str]],
            Sequence[Tuple[Files, str]],
            Sequence[Tuple[Project, str]]
    ]:
        """ Return list of content in directory
            with ownership
        """
        dirs = self.session.query(
            Directory.id,
            Directory.name,
            Directory.directory_parent_id,
            Directory.projects_id,
            Directory.user_id,
            AppUser.username,
        ).join(
            AppUser, Directory.user_id == AppUser.id
        ).filter(
            Directory.directory_parent_id == current_dir.id
        ).all()

        def process_directory(tuple_val):
            tuple_key = (
                'id',
                'name',
                'directory_parent_id',
                'projects_id',
                'user_id',
                'username'
            )

            d = dict(zip(tuple_key, tuple_val))
            d = AttrDict(d)

            return d

        dirs = list(map(process_directory, dirs))

        files = self.session.query(
            Files.id,
            Files.file_id,
            Files.filename,
            Files.description,
            Files.content_id,
            Files.user_id,
            Files.creation_date,
            Files.annotations_date,
            Files.project,
            Files.dir_id,
            Files.doi,
            Files.upload_url,
            AppUser.username,
        ).join(
            AppUser, Files.user_id == AppUser.id
        ).filter(
            Files.dir_id == current_dir.id
        ).all()

        def process_file(tuple_val):
            tuple_key = (
                'id',
                'file_id',
                'filename',
                'description',
                'content_id',
                'user_id',
                'creation_date',
                'annotations_date',
                'project',
                'dir_id',
                'doi',
                'upload_url',
                'username',
            )

            f = dict(zip(tuple_key, tuple_val))
            f = AttrDict(f)

            return f

        files = list(map(process_file, files))

        maps = self.session.query(
            Project.id,
            Project.label,
            Project.description,
            Project.date_modified,
            Project.author,
            Project.public,
            Project.user_id,
            Project.dir_id,
            Project.hash_id,
            AppUser.username
        ).join(
            AppUser, Project.user_id == AppUser.id
        ).filter(
            Project.dir_id == current_dir.id
        ).all()

        def process_map(tuple_val):
            tuple_key = (
                'id',
                'label',
                'description',
                'date_modified',
                'author',
                'public',
                'user_id',
                'dir_id',
                'hash_id',
                'username'
            )

            m = dict(zip(tuple_key, tuple_val))
            m = AttrDict(m)

            return m

        maps = list(map(process_map, maps))

        return dirs, files, maps
