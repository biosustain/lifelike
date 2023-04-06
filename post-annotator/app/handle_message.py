import enum
import json
import os
import timeflake

from datetime import datetime
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, Enum, Integer, MetaData, String, Table, create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TIMESTAMP
from typing import Tuple

from .constants import TIMEZONE
from .logs import get_logger

# Get Postgres vars
PG_HOST=os.environ.get('POSTGRES_HOST', 'pgdatabase')
PG_PORT=os.environ.get('POSTGRES_PORT', '5432')
PG_USER=os.environ.get('POSTGRES_USER', 'postgres')
PG_PASSWORD=os.environ.get('POSTGRES_PASSWORD', 'postgres')
PG_DB=os.environ.get('POSTGRES_DB', 'postgres')
POSTGRES_CONNECTION_URL = f'postgresql+psycopg2://{PG_USER}:{PG_PASSWORD}@{PG_HOST}/{PG_DB}'

logger = get_logger()


# copied from /models/files.py
class AnnotationChangeCause(enum.Enum):
    USER = 'user'
    USER_REANNOTATION = 'user_reannotation'
    SYSTEM_REANNOTATION = 'sys_reannotation'


def _generate_hash_id():
    # Roughly-ordered identifier with an extremely low chance of collision
    return timeflake.random().base62

t_files = Table(
    'files',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('user_id', Integer),
    Column('annotations', JSONB),
    Column('annotations_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('custom_annotations', JSONB),
    Column('excluded_annotations', JSONB),
    Column('enrichment_annotations', JSONB),
)

t_file_annotations_version = Table(
    'file_annotations_version',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('file_id', Integer),
    Column('cause', Enum(AnnotationChangeCause)),
    Column('custom_annotations', JSONB, default='[]'),
    Column('excluded_annotations', JSONB, default='[]'),
    Column('user_id', Integer),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('modified_date', TIMESTAMP(timezone=True), default=func.now()),
)


def _get_postgres_session():
    logger.info('Creating Postgres connection...')
    engine = create_engine(POSTGRES_CONNECTION_URL)
    Session = sessionmaker(bind=engine)
    logger.info('Postgres connection established.')
    return Session()


def update_tables(body: dict) -> Tuple[str, str]:
    session = _get_postgres_session()
    file_id = body['file_id']

    try:
        logger.info('Updating Files table with new annotations...')
        logger.debug(json.dumps(body))
        session.execute(
            t_files.update().where(
                t_files.c.id == file_id
            ).values(
                annotations=body['annotations'],
                enrichment_annotations=body.get('enrichment_annotations', None),
                annotations_date=datetime.now(TIMEZONE)
            )
        )
        logger.info('File annotations updated.')

        logger.info('Fetching data from Files table for FileAnnotationsVersion insert...')
        file_hash_id, file_user_id, inclusions, exclusions = session.execute(
            select([
                t_files.c.hash_id,
                t_files.c.user_id,
                t_files.c.custom_annotations,
                t_files.c.excluded_annotations
            ]).where(
                t_files.c.id == file_id
            )
        ).first()
        logger.info('Insert data fetched.')

        file_annotations_version_hash_id = _generate_hash_id()

        insert_data = dict(
            hash_id=file_annotations_version_hash_id,
            file_id=file_id,
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=inclusions,
            excluded_annotations=exclusions,
            user_id=file_user_id
        )

        logger.info('Inserting data into FileAnnotationsVersion...')
        logger.debug(insert_data)
        session.execute(
            t_file_annotations_version.insert().values(**insert_data)
        )
        logger.info('FileAnnotationsVersion updated. Closing Postgres connection...')
        session.commit()

    except Exception as e:
        logger.error(e, exc_info=True)
        logger.error('Rolling back database changes...')
        session.rollback()
        return

    session.close()
    return file_hash_id, file_annotations_version_hash_id
