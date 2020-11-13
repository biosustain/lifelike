"""TODO: Possibly turn this into a DAO in the future.
For now, it's just a file with query functions to help DRY.
"""
from typing import List, Set

from sqlalchemy import and_

from .files import Files, FileContent, FallbackOrganism

from neo4japp.database import db


def get_all_files_and_content_by_id(file_ids: Set[str], project_id: int):
    sub_query = db.session.query(FallbackOrganism.id.label('fallback_organism_id')).subquery()
    query = db.session.query(
        Files.id,
        Files.annotations,
        Files.custom_annotations,
        Files.excluded_annotations,
        Files.file_id,
        Files.filename,
        FileContent.id.label('file_content_id'),
        FileContent.raw_file,
        FileContent.parsed_content,
        sub_query.c.fallback_organism_id
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    )

    return query.outerjoin(
        sub_query,
        and_(sub_query.c.fallback_organism_id == Files.fallback_organism_id))


def get_all_files_by_id(file_ids: Set[str], project_id: int):
    files = db.session.query(
        Files,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    ).all()
    return files


def filename_exist(filename: str, directory_id: int, project_id: int):
    q = db.session.query(Files.id).filter(
        Files.filename == filename,
        Files.dir_id == directory_id,
        Files.project == project_id
    )
    return db.session.query(q.exists()).scalar()
