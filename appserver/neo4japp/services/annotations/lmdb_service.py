import csv
import json
from os import path
from typing import Callable, Dict, Any

import lmdb

from neo4japp.utils import normalize_str
from .constants import (
    CHEMICALS_LMDB,
    COMPOUNDS_LMDB,
    DISEASES_LMDB,
    GENES_LMDB,
    PHENOMENAS_LMDB,
    PHENOTYPES_LMDB,
    PROTEINS_LMDB,
    SPECIES_LMDB,
    FOODS_LMDB,
    ANATOMY_LMDB,
    EntityType,
)
from .lmdb_connection import LMDBConnection
from .utils.lmdb import (
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenomena,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species,
)

# reference to this directory
directory = path.realpath(path.dirname(__file__))

LMDB_CHEMICALS_SOURCE = 'datasets/chebi.tsv'
LMDB_COMPOUNDS_SOURCE = 'datasets/compounds.csv'
LMDB_DISEASES_SOURCE = 'datasets/disease.tsv'
LMDB_GENES_SOURCE = 'datasets/genes.tsv'
LMDB_PSEUDOMONAS_GENES_SOURCE = 'datasets/pseudomonasCyc_genes.tsv'
LMDB_PHENOMONAS_SOURCE = 'datasets/phenomena.tsv'
LMDB_PHENOTYPE_SOURCE = 'datasets/phenotype.tsv'
LMDB_PROTEINS_SOURCE = 'datasets/proteins.tsv'
LMDB_UNIPROT_PROTEINS_SOURCE = 'datasets/sprot2syn_gene.tsv'
LMDB_TAXONOMY_SOURCE = 'datasets/taxonomy.tsv'
LMDB_COVID_TAXONOMY_SOURCE = 'datasets/covid19_taxonomy2.tsv'
LMDB_FOOD_SOURCE = 'datasets/food.tsv'
LMDB_ANATOMY_SOURCE = 'datasets/anatomy.tsv'


"""JIRA LL-1015:
Change the structure of LMDB to allow duplicate keys. The reason
is because there can be synonyms that are also common names,
e.g chebi and compounds, and we want to avoid losing the synonyms
of these synonyms that are also common names.

Previously we were collapsing into a collection `common_name`. But
we don't want that, instead row in LMDB should represent a row in the datset.

Additionally, this also fixes the collapsing of genes. A gene can
appear multiple times in a dataset, with each time, it has a different
gene id and references a different taxonomy id. By allowing duplicate
keys, we do not lose these genes.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
IMPORTANT NOTE: As of lmdb 0.98
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
In order for `dupsort` to work, need to provide a database name to
`open_db()`, e.g open_db('db2', dupsort=True).

If no database name is passed in, it will open the default database,
and the transaction and cursor will point to the wrong address in
memory and retrieve whatever is there.
"""


class LMDBService(LMDBConnection):
    def __init__(self, dirpath: str, **kwargs) -> None:
        super().__init__(dirpath, **kwargs)
        self.map_size = 1099511627776

    def _lmdb_open(self, file):
        return lmdb.open(
            path.join(directory, 'lmdb', file), map_size=self.map_size, max_dbs=2
        )

    def create_lmdb_genes_database(self):
        for filename in [LMDB_GENES_SOURCE, LMDB_PSEUDOMONAS_GENES_SOURCE]:
            with open(path.join(directory, filename), 'r') as f:
                env = self._lmdb_open('genes')
                db = env.open_db(GENES_LMDB.encode('utf-8'), dupsort=True)

                with env.begin(db=db, write=True) as transaction:
                    reader = csv.reader(f, delimiter='\t', quotechar='"')
                    # skip headers
                    # geneId	geneName	synonym	data_source
                    next(reader)
                    for line in reader:
                        gene_name = line[1]
                        synonym = line[2]
                        data_source = line[3]

                        gene = create_ner_type_gene(
                            name=gene_name, synonym=synonym, data_source=data_source
                        )

                        try:
                            transaction.put(
                                normalize_str(synonym).encode('utf-8'),
                                json.dumps(gene).encode('utf-8'),
                            )
                        except lmdb.BadValsizeError:
                            # ignore any keys that are too large
                            # LMDB has max key size 512 bytes
                            # can change but larger keys mean performance issues
                            continue
        print('Done creating genes')

    def create_lmdb_unified_entity_database(
        self,
        _path: str,
        _type: str,
        _lmdb: str,
        _entity_factory: Callable[[str, str, str], Dict[str, Any]],
    ):
        with open(path.join(directory, _path), 'r') as f:
            env = self._lmdb_open(_type)
            db = env.open_db(_lmdb.encode('utf-8'), dupsort=True)

            with env.begin(db=db, write=True) as transaction:
                reader = csv.reader(f, delimiter='\t', quotechar='"')
                # skip headers
                # id	name	synonym
                next(reader)
                for line in reader:
                    entity = _entity_factory(*line[:3])

                    try:
                        transaction.put(
                            normalize_str(entity['synonym']).encode('utf-8'),
                            json.dumps(entity).encode('utf-8'),
                        )
                    except lmdb.BadValsizeError:
                        # ignore any keys that are too large
                        # LMDB has max key size 512 bytes
                        # can change but larger keys mean performance issues
                        continue
        print(f'Done creating {type}')

    def create_lmdb_chemicals_database(self):
        self.create_lmdb_unified_entity_database(
            LMDB_CHEMICALS_SOURCE, 'chemicals', CHEMICALS_LMDB, create_ner_type_chemical
        )

    def create_lmdb_compounds_database(self):
        with open(path.join(directory, LMDB_COMPOUNDS_SOURCE), 'r') as f:
            env = self._lmdb_open('compounds')
            db = env.open_db(COMPOUNDS_LMDB.encode('utf-8'), dupsort=True)

            with env.begin(db=db, write=True) as transaction:
                reader = csv.reader(f, delimiter=',', quotechar='"')
                # skip headers
                # n.biocyc_id,n.common_name,n.synonyms
                next(reader)
                for line in reader:
                    compound_id = line[0]
                    compound_name = line[1]
                    synonyms = line[2].split('|')

                    if compound_name != 'null':
                        compound = create_ner_type_compound(
                            id=compound_id,
                            name=compound_name,
                            synonym=compound_name,
                        )

                        try:
                            transaction.put(
                                normalize_str(compound_name).encode('utf-8'),
                                json.dumps(compound).encode('utf-8'),
                            )

                            if synonyms:
                                for synonym_term in synonyms:
                                    if synonym_term != 'null':
                                        normalized_key = normalize_str(synonym_term)

                                        synonym = create_ner_type_compound(
                                            id=compound_id,
                                            name=compound_name,
                                            synonym=synonym_term,
                                        )

                                        transaction.put(
                                            normalized_key.encode('utf-8'),
                                            json.dumps(synonym).encode('utf-8'),
                                        )
                        except lmdb.BadValsizeError:
                            # ignore any keys that are too large
                            # LMDB has max key size 512 bytes
                            # can change but larger keys mean performance issues
                            continue
        print('Done creating compounds')

    def create_lmdb_proteins_database(self):
        for filename in [LMDB_PROTEINS_SOURCE, LMDB_UNIPROT_PROTEINS_SOURCE]:
            with open(path.join(directory, filename), 'r') as f:
                env = self._lmdb_open('proteins')
                db = env.open_db(PROTEINS_LMDB.encode('utf-8'), dupsort=True)

                with env.begin(db=db, write=True) as transaction:
                    reader = csv.reader(f, delimiter='\t', quotechar='"')
                    # skip headers (only care for first 3)
                    # id	name	synonym	...
                    next(reader)
                    for line in reader:
                        # synonyms already have their own line in dataset
                        #
                        protein_id = line[1]
                        protein_name = line[2]
                        # changed protein_id to protein_name for now (JIRA LL-671)
                        # will eventually change back to protein_id
                        protein = create_ner_type_protein(
                            name=protein_name, synonym=protein_name
                        )

                        try:
                            transaction.put(
                                normalize_str(protein_name).encode('utf-8'),
                                json.dumps(protein).encode('utf-8'),
                            )
                        except lmdb.BadValsizeError:
                            # ignore any keys that are too large
                            # LMDB has max key size 512 bytes
                            # can change but larger keys mean performance issues
                            continue
        print('Done creating proteins')

    def create_lmdb_species_database(self):
        for filename in [LMDB_TAXONOMY_SOURCE, LMDB_COVID_TAXONOMY_SOURCE]:
            with open(path.join(directory, filename), 'r') as f:
                env = self._lmdb_open('species')
                db = env.open_db(SPECIES_LMDB.encode('utf-8'), dupsort=True)

                with env.begin(db=db, write=True) as transaction:
                    reader = csv.reader(f, delimiter='\t', quotechar='"')
                    # skip headers
                    # tax_id	rank	category	name	name_class
                    next(reader)
                    for line in reader:
                        # synonyms already have their own line in dataset
                        #
                        species_id = line[0]
                        species_category = line[2]
                        species_name = line[3]

                        species = create_ner_type_species(
                            id=species_id,
                            category=species_category
                            if species_category
                            else 'Uncategorized',
                            name=species_name,
                            synonym=species_name,
                        )

                        try:
                            transaction.put(
                                normalize_str(species_name).encode('utf-8'),
                                json.dumps(species).encode('utf-8'),
                            )
                        except lmdb.BadValsizeError:
                            # ignore any keys that are too large
                            # LMDB has max key size 512 bytes
                            # can change but larger keys mean performance issues
                            continue
        print('Done creating taxonomy')

    def create_lmdb_diseases_database(self):
        return self.create_lmdb_unified_entity_database(
            LMDB_DISEASES_SOURCE, 'diseases', DISEASES_LMDB, create_ner_type_disease
        )

    def create_lmdb_phenomenas_database(self):
        return self.create_lmdb_unified_entity_database(
            LMDB_PHENOMONAS_SOURCE,
            'phenomenas',
            PHENOMENAS_LMDB,
            create_ner_type_phenomena,
        )

    def create_lmdb_phenotypes_database(self):
        return self.create_lmdb_unified_entity_database(
            LMDB_PHENOTYPE_SOURCE,
            'phenotypes',
            PHENOTYPES_LMDB,
            create_ner_type_phenotype,
        )

    def create_lmdb_foods_database(self):
        return self.create_lmdb_unified_entity_database(
            LMDB_FOOD_SOURCE, 'foods', FOODS_LMDB, create_ner_type_food
        )

    def create_lmdb_anatomy_database(self):
        return self.create_lmdb_unified_entity_database(
            LMDB_ANATOMY_SOURCE, 'anatomy', ANATOMY_LMDB, create_ner_type_anatomy
        )

    def create_lmdb_files(self, file_type=None):
        funcs = {
            EntityType.ANATOMY.value: self.create_lmdb_anatomy_database,
            EntityType.CHEMICAL.value: self.create_lmdb_chemicals_database,
            EntityType.COMPOUND.value: self.create_lmdb_compounds_database,
            EntityType.DISEASE.value: self.create_lmdb_diseases_database,
            EntityType.FOOD.value: self.create_lmdb_foods_database,
            EntityType.GENE.value: self.create_lmdb_genes_database,
            EntityType.PHENOMENA.value: self.create_lmdb_phenomenas_database,
            EntityType.PHENOTYPE.value: self.create_lmdb_phenotypes_database,
            EntityType.PROTEIN.value: self.create_lmdb_proteins_database,
            EntityType.SPECIES.value: self.create_lmdb_species_database,
        }

        if file_type is None:
            for func in funcs.values():
                func()
        elif file_type in funcs:
            funcs[file_type]()
        else:
            raise ValueError(
                f'Invalid argument, cannot identify which LMDB file to create: {file_type}'
            )
