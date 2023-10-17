from flask import g

from neo4japp.database import db
from neo4japp.models import Projects, AppUser
from neo4japp.services.filesystem import Filesystem


class Publish:
    @staticmethod
    def get_publish_project_name(user_hash_id: str):
        return f'!publish@{user_hash_id}'

    @staticmethod
    def is_publish_project(project: Projects):
        return project.name.startswith('!publish@')

    @classmethod
    def create_uncommited_publication(
        cls, user_hash_id: str, *, creator: AppUser = None, **kwargs
    ):
        publish_project = Projects.get_or_create(
            name=cls.get_publish_project_name(user_hash_id),
            creator=creator or g.current_user,
            description=(
                'Project containing user published files '
                '(publically available on the lifelike website)'
            ),
            role='project-write',  # only write - this is system managed
        )
        file = Filesystem.create_file(
            **kwargs,
            parent=publish_project.root,
        )

        db.session.add(file)

        return file
