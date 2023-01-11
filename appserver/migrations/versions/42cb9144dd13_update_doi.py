"""update DOI

Revision ID: 42cb9144dd13
Revises: bc9d080502da
Create Date: 2021-04-27 13:50:40.622862

"""
import io
import re

from alembic import context
from alembic import op
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.session import Session
from pdfminer import high_level
from io import BufferedIOBase
from typing import Optional
import requests

# revision identifiers, used by Alembic.

revision = '42cb9144dd13'
down_revision = 'bc9d080502da'
branch_labels = None
depends_on = None

db = SQLAlchemy()

BYTE_ENCODING = 'utf-8'
common_escape_patterns_re = re.compile(rb'\\')
doi_re = re.compile(
    # match label pointing that it is DOI
    rb'(doi[\W]*)?'
    # match url to doi.org
    # doi might contain subdomain or 'www' etc.
    rb'((?:https?:\/\/)(?:[-A-z0-9]*\.)*doi\.org\/)?'
    # match folder (10) and register name
    rb'(10\.[0-9]{3,}(?:[\.][0-9]+)*\/)'
    # try match commonly used DOI format
    rb'([-A-z0-9]*)'
    # match up to first space (values after # are ~ignored anyway)
    rb'([^ \n\f#]*)'
    # match up to 20 characters in the same line (values after # are ~ignored anyway)
    rb'([^\n\f#]{0,20})',
    flags=re.IGNORECASE
)
dash_types_re = re.compile(bytes("[‐᠆﹣－⁃−¬]+", BYTE_ENCODING))
characters_groups_re = re.compile(r'([a-z]+|[A-Z]+|[0-9]+|-+|[^-A-z0-9]+)')

def is_valid_doi(doi):
    try:
        # not [bad request, not found] but yes to 403 - no access
        return requests.get(doi,
                            headers={
                                # sometimes request is filtered if there is no user-agent header
                                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                                              "AppleWebKit/537.36 "
                                              "(KHTML, like Gecko) Chrome/51.0.2704.103 "
                                              "Safari/537.36"
                            }
                            ).status_code not in [400, 404]
    except Exception as e:
        return False

def _search_doi_in(content: bytes) -> Optional[str]:
    doi: Optional[str]
    try:
        for match in doi_re.finditer(content):
            label, url, folderRegistrant, likelyDOIName, tillSpace, DOISuffix = \
                [s.decode(BYTE_ENCODING, errors='ignore') if s else '' for s in match.groups()]
            certainly_doi = label + url
            url = 'https://doi.org/'
            # is whole match a DOI? (finished on \n, trimmed whitespaces)
            doi = ((url + folderRegistrant + likelyDOIName + tillSpace +
                    DOISuffix).strip())
            if is_valid_doi(doi):
                return doi
            # is match till space a DOI?
            doi = (url + folderRegistrant + likelyDOIName + tillSpace)
            if is_valid_doi(doi):
                return doi
            # make deep search only if there was clear indicator that it is a doi
            if certainly_doi:
                # if contains escape patterns try substitute them
                if common_escape_patterns_re.search(match.group()):
                    doi = _search_doi_in(
                        common_escape_patterns_re.sub(
                            b'', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # try substitute different dash types
                if dash_types_re.search(match.group()):
                    doi = _search_doi_in(
                        dash_types_re.sub(
                            b'-', match.group()
                        )
                    )
                    if is_valid_doi(doi):
                        return doi
                # we iteratively start cutting off suffix on each group of
                # unusual characters
                try:
                    reversedDOIEnding = (tillSpace + DOISuffix)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + likelyDOIName + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # we iteratively start cutting off suffix on each group of either
                # lowercase letters
                # uppercase letters
                # numbers
                try:
                    reversedDOIEnding = (likelyDOIName + tillSpace)[::-1]
                    while reversedDOIEnding:
                        _, _, reversedDOIEnding = characters_groups_re.split(
                            reversedDOIEnding, 1)
                        doi = (
                                url + folderRegistrant + reversedDOIEnding[::-1]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception:
                    pass
                # yield 0 matches on test case
                # # is it a DOI in common format?
                # doi = (url + folderRegistrant + likelyDOIName)
                # if self._is_valid_doi(doi):
                #     print('match by common format xxx')
                #     return doi
                # in very rare cases there is \n in text containing doi
                try:
                    end_of_match_idx = match.end(0)
                    first_char_after_match = content[end_of_match_idx:end_of_match_idx + 1]
                    if first_char_after_match == b'\n':
                        doi = _search_doi_in(
                            # new input = match + 50 chars after new line
                            match.group() +
                            content[end_of_match_idx + 1:end_of_match_idx + 1 + 50]
                        )
                        if is_valid_doi(doi):
                            return doi
                except Exception as e:
                    pass
    except Exception as e:
        pass
    return None

def extract_doi(self, buffer: BufferedIOBase) -> Optional[str]:
    data = buffer.read()
    buffer.seek(0)

    # Attempt 1: search through the first N bytes (most probably containing only metadata)
    chunk = data[:2 ** 17]
    doi = _search_doi_in(chunk)
    if doi is not None:
        return doi

    # Attempt 2: search through the first two pages of text (no metadata)
    fp = io.BytesIO(data)
    text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
    doi = _search_doi_in(bytes(text, encoding='utf8'))

    return doi

class Files(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    mime_type = db.Column(db.String(127), nullable=False)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True, nullable=True)
    content = db.relationship('FileContent', foreign_keys=content_id)
    doi = db.Column(db.String(1024), nullable=True)


class FileContent(db.Model):
    __tablename__ = 'files_content'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    raw_file = db.Column(db.LargeBinary, nullable=False)


def recalculate_doi_based_on_current_algorithm():
    session = Session(op.get_bind())

    for file in session.query(Files) \
            .filter(Files.mime_type == 'application/pdf') \
            .join(Files.content) \
            .with_entities(Files.id, Files.doi, FileContent.raw_file):

        buffer = io.BytesIO(file.raw_file)
        extracted_doi = extract_doi(buffer)

        session.query(Files)\
            .filter(Files.id == file.id)\
            .update(dict(doi=extracted_doi))


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    recalculate_doi_based_on_current_algorithm()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    recalculate_doi_based_on_current_algorithm()
