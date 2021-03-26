import json
from dataclasses import dataclass
from functools import partial

from flask import (
    Blueprint
)
from flask_marshmallow import Schema
from marshmallow import fields, ValidationError
from marshmallow.validate import Regexp, OneOf
from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_visualisation_service
from neo4japp.services.redis import redis_cached
from webargs.flaskparser import use_args

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')


@dataclass
class Organism:
    id: int
    name: str

    def __str__(self):
        return f"{self.id}/{self.name}"


class OrganismField(fields.Field):
    validators = [Regexp(r'\d+/.+')]
    default_error_messages = {
        "required": "Missing data for required field.",
        "null": "Field may not be null.",
        "validator_failed": "Organism must be defined as 'taxID/name'.",
    }

    def _serialize(self, value, attr, obj, **kwargs):
        return str(value)

    def _deserialize(self, value, attr, data, **kwargs):
        try:
            return Organism(*value.split('/'))
        except ValueError as error:
            raise ValidationError("Organism field must be filled as taxID/name") from error


class GeneOrganismSchema(Schema):
    geneNames = fields.List(fields.Str)
    organism = OrganismField()


class EnrichmentSchema(GeneOrganismSchema):
    analysis = fields.Str(validate=OneOf(['fisher']))

@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
@use_args(EnrichmentSchema)
def enrich_go(args):
    gene_names = args['geneNames']
    organism = args['organism']
    analysis = args['analysis']
    cache_id = '_'.join(['enrich_go', ','.join(gene_names), analysis, str(organism)])
    enrichment_visualisation = get_enrichment_visualisation_service()
    return redis_cached(
            cache_id, partial(enrichment_visualisation.enrich_go, gene_names, analysis, organism)
    ), dict(mimetype='application/json')
