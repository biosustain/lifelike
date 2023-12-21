import pathlib
from typing import Type, Union

from flask import g

from neo4japp.database import db
from neo4japp.models import Projects, AppUser
from neo4japp.services.filesystem import Filesystem


class Publish:
    @staticmethod
    def get_publish_project_name(user_hash_id: str):
        return f'!publish@{user_hash_id}'

    @staticmethod
    def is_publish_project(project: Union[Type[Projects], Projects]):
        return project.name.startswith('!publish@')

    @classmethod
    def create_uncommited_publication(
        cls, user_hash_id: str, filename, *, extension, creator: AppUser = None, **kwargs
    ):
        publish_project = Projects.get_or_create(
            name=cls.get_publish_project_name(user_hash_id),
            creator=creator or g.current_user,
            description=(
                'Project containing user published files '
                '(publically available on the ***ARANGO_DB_NAME*** website)'
            ),
            role='project-write',  # only write - this is system managed
        )
        filename_path = pathlib.Path(filename)
        if filename_path.suffix == '.zip':
            filename = str(filename_path.with_suffix(''))
        file = Filesystem.create_file(
            **kwargs,
            filename=filename,
            extension=(extension or '').replace('.prepublish.dump.zip', '.dump.zip'),
            parent=publish_project.***ARANGO_USERNAME***,
        )

        db.session.add(file)

        return file
