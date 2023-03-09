"""Fix the domainInfo property for enrichment table

Revision ID: 8014884fe113
Revises: 0b082b5d8f1f
Create Date: 2021-08-10 17:04:59.000590

"""
import hashlib
import json
from os import path

import fastjsonschema
import sqlalchemy as sa
from alembic import context
from alembic import op
from marshmallow import fields
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column, and_

from migrations.utils import window_chunk
from neo4japp.constants import FILE_MIME_TYPE_ENRICHMENT_TABLE
from neo4japp.models import Files, FileContent

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.schemas.base import CamelCaseSchema

# revision identifiers, used by Alembic.
revision = "8014884fe113"
down_revision = "0b082b5d8f1f"
branch_labels = None
depends_on = None

directory = path.realpath(path.dirname(__file__))
schema_file = path.join(
    directory, "../..", "neo4japp/schemas/formats/enrichment_tables_v5.json"
)


# copied from neo4japp.schemas.enrichment
# changed to snakecase to easily convert to camelcase
class EnrichmentValue(CamelCaseSchema):
    text = fields.String(required=True)
    annotated_text = fields.String(allow_none=True)
    link = fields.String(required=True)


class EnrichedGene(CamelCaseSchema):
    imported = fields.String(allow_none=True)
    matched = fields.String(allow_none=True)
    full_name = fields.String(allow_none=True)
    annotated_imported = fields.String(allow_none=True)
    annotated_matched = fields.String(allow_none=True)
    annotated_full_name = fields.String(allow_none=True)
    link = fields.String(allow_none=True)
    domains = fields.Dict(
        keys=fields.String(),
        values=fields.Dict(keys=fields.String(), values=fields.Nested(EnrichmentValue)),
        allow_none=True,
    )


class DomainInfo(CamelCaseSchema):
    labels = fields.List(fields.String())


class EnrichmentResult(CamelCaseSchema):
    version = fields.String(required=True)
    domain_info = fields.Dict(
        keys=fields.String(), values=fields.Nested(DomainInfo), required=True
    )
    genes = fields.List(fields.Nested(EnrichedGene), required=True)


class EnrichmentData(CamelCaseSchema):
    genes = fields.String(required=True)
    tax_id = fields.String(required=True)
    organism = fields.String(required=True)
    sources = fields.List(fields.String())


class EnrichmentTableSchema(CamelCaseSchema):
    data = fields.Nested(EnrichmentData, required=True)
    result = fields.Nested(EnrichmentResult, required=True)


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause1 = table(
        "files",
        column("id", sa.Integer),
        column("content_id", sa.Integer),
        column("mime_type", sa.String),
        column("enrichment_annotations", postgresql.JSONB),
    )

    tableclause2 = table(
        "files_content", column("id", sa.Integer), column("raw_file", sa.LargeBinary)
    )

    files = conn.execution_options(stream_results=True).execute(
        sa.select(
            [
                tableclause1.c.id.label("file_id"),
                tableclause1.c.enrichment_annotations,
                tableclause2.c.id.label("file_content_id"),
                tableclause2.c.raw_file,
            ]
        ).where(
            and_(
                tableclause1.c.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE,
                tableclause1.c.enrichment_annotations.isnot(None),
                tableclause1.c.content_id == tableclause2.c.id,
            )
        )
    )

    with open(schema_file, "rb") as f:
        validate_enrichment_table = fastjsonschema.compile(json.load(f))

        file_content_hashes = {}
        for chunk in window_chunk(files, 25):
            raws_to_update = []
            files_to_update = []
            for fid, annos, fcid, raw in chunk:
                current = raw
                found_err = False

                try:
                    json.loads(current)
                except Exception:
                    # TODO: what to do with these?
                    # they're literal strings, e.g 'AK3,AK4/9606/Homo sapiens/...'
                    # only in STAGE db
                    continue
                else:
                    while True:
                        try:
                            enriched_table = json.loads(current)
                            validate_enrichment_table(enriched_table)

                            file_obj = {"id": fid}

                            if found_err:
                                new_hash = hashlib.sha256(current).digest()

                                # because we are fixing JSONs, it is possible
                                # to have collision since fixing a JSON
                                # can potentially result in an existing JSON
                                if new_hash not in file_content_hashes:
                                    file_content_hashes[new_hash] = fcid
                                    raws_to_update.append(
                                        {
                                            "id": fcid,
                                            "raw_file": current,
                                            "checksum_sha256": new_hash,
                                        }
                                    )  # noqa
                                else:
                                    file_obj["content_id"] = file_content_hashes[
                                        new_hash
                                    ]

                            if annos:
                                if "domainInfo" not in annos["result"]:
                                    # in EnrichmentAnnotationsView, the enrichment annotations
                                    # is being returned to the client using EnrichmentTableSchema
                                    # since what is in the db validates against that schema
                                    # it should be the same here
                                    annos = EnrichmentTableSchema().dump(annos)

                                try:
                                    validate_enrichment_table(annos)
                                    file_obj["enrichment_annotations"] = annos
                                except Exception:
                                    # separate migration to handle the annotations
                                    # as this while loop will get too complicated
                                    # trying to do both
                                    pass

                            if len(file_obj) > 1:
                                files_to_update.append(file_obj)
                            break
                        except Exception as e:
                            found_err = True
                            err = str(e)

                            if (
                                err
                                == "data.result must not contain {'version'} properties"
                            ):
                                enriched_table["result"].pop("version")

                            if err == "data.data must be object":
                                data_split = enriched_table["data"].split("/")
                                enriched_table["data"] = {
                                    "genes": data_split[0],
                                    "taxId": data_split[1],
                                    "organism": data_split[2],
                                    "sources": [d for d in data_split[-1].split(",")]
                                    if data_split[-1]
                                    else [],  # noqa
                                }

                            if "data.data.sources" in err and "must be one of" in err:
                                curr_sources = enriched_table["data"]["sources"]
                                new_sources = []
                                for s in curr_sources:
                                    if s.lower() == "biocyc":
                                        new_sources.append("BioCyc")
                                    elif s.lower() == "go":
                                        new_sources.append("GO")
                                    elif s.lower() == "kegg":
                                        new_sources.append("KEGG")
                                    elif s.lower() == "regulon":
                                        new_sources.append("Regulon")
                                    elif s.lower() == "string":
                                        new_sources.append("String")
                                    elif s.lower() == "uniprot":
                                        new_sources.append("UniProt")
                                enriched_table["data"]["sources"] = new_sources

                            if "domains must not contain" in err:
                                acceptable_domains = {
                                    "GO",
                                    "BioCyc",
                                    "String",
                                    "Regulon",
                                    "UniProt",
                                    "KEGG",
                                }  # noqa
                                for gene in enriched_table["result"]["genes"]:
                                    if "domains" not in gene:
                                        # valid not an error
                                        continue
                                    domain_keys = [d for d in gene["domains"]]
                                    for domain in domain_keys:
                                        if domain not in acceptable_domains:
                                            data = gene["domains"][domain]
                                            domain_lowered = domain.lower()

                                            if domain_lowered == "biocyc":
                                                gene["domains"]["BioCyc"] = data
                                                gene["domains"].pop(domain)
                                            elif domain_lowered == "go":
                                                gene["domains"]["GO"] = data
                                                gene["domains"].pop(domain)
                                            elif domain_lowered == "kegg":
                                                gene["domains"]["KEGG"] = data
                                                gene["domains"].pop(domain)
                                            elif domain_lowered == "regulon":
                                                gene["domains"]["Regulon"] = data
                                                gene["domains"].pop(domain)
                                            elif domain_lowered == "string":
                                                gene["domains"]["String"] = data
                                                gene["domains"].pop(domain)
                                            elif domain_lowered == "uniprot":
                                                gene["domains"]["UniProt"] = data
                                                gene["domains"].pop(domain)

                            if "domainInfo must not contain" in err:
                                domain_info = enriched_table["result"]["domainInfo"]
                                acceptable_domains = {
                                    "GO",
                                    "BioCyc",
                                    "String",
                                    "Regulon",
                                    "UniProt",
                                    "KEGG",
                                }  # noqa

                                keys = [k for k in domain_info]
                                for key in keys:
                                    if key not in acceptable_domains:
                                        key_lowered = key.lower()

                                        if key_lowered == "biocyc":
                                            domain_info["BioCyc"] = domain_info[key]
                                            domain_info.pop(key)
                                        elif key_lowered == "go":
                                            domain_info["GO"] = domain_info[key]
                                            domain_info.pop(key)
                                        elif key_lowered == "kegg":
                                            domain_info["KEGG"] = domain_info[key]
                                            domain_info.pop(key)
                                        elif key_lowered == "regulon":
                                            domain_info["Regulon"] = domain_info[key]
                                            domain_info.pop(key)
                                        elif key_lowered == "string":
                                            domain_info["String"] = domain_info[key]
                                            domain_info.pop(key)
                                        elif key_lowered == "uniprot":
                                            domain_info["UniProt"] = domain_info[key]
                                            domain_info.pop(key)

                            current = json.dumps(
                                enriched_table, separators=(",", ":")
                            ).encode(
                                "utf-8"
                            )  # noqa
            try:
                session.bulk_update_mappings(Files, files_to_update)
                session.bulk_update_mappings(FileContent, raws_to_update)
                session.commit()
            except Exception:
                raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
