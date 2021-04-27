"""update DOI

Revision ID: 42cb9144dd13
Revises: bc9d080502da
Create Date: 2021-04-27 13:50:40.622862

"""
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
from neo4japp.models import Files, FileContent
from neo4japp.services.file_types.providers import PDFTypeProvider

revision = '42cb9144dd13'
down_revision = 'bc9d080502da'
branch_labels = None
depends_on = None

def recalculate_doi_based_on_current_algorithm():
    pdf_type_provider = PDFTypeProvider()
    for file in op.session.query(Files)\
        .filter(Files.mime_type == 'application/pdf')\
        .join(Files.content)\
        .with_entities(Files.filename, Files.doi, FileContent.raw_file):

        buffer = io.BytesIO(file.raw_file)
        file.doi = pdf_type_provider.extract_doi(buffer)

        file.save()
        print(f'saved {file}')

def upgrade():
    pass
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
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
