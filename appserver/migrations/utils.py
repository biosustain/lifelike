from arango.client import ArangoClient
import multiprocessing as mp
from typing import Dict, List

from neo4japp.database import get_or_create_arango_client
# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import Files
from neo4japp.services.annotations.constants import EntityType
from neo4japp.services.annotations.utils.graph_queries import get_docs_by_ids_query
from neo4japp.services.arangodb import execute_arango_query, get_db


def window_chunk(q, windowsize=100):
    """Yields chunks of data as a stream with only that chunk
    in memory.

    This means `q` is a ProxyResult used with the argument `stream_results`.
        - e.g conn.execution_options(stream_results=True).execute(...)
    """
    while True:
        chunk = q.fetchmany(windowsize)
        if not chunk:
            break
        yield chunk


# NOTE DEPRECATED: just used in old migration
def _get_mesh_by_ids_query():
    return """
    FOR doc IN mesh
        FILTER 'TopicalDescriptor' IN doc.labels
        FILTER doc.eid IN @ids
        RETURN {'mesh_id': doc.eid, 'mesh_name': doc.name}
    """


def _get_mesh_from_mesh_ids(arango_client: ArangoClient, mesh_ids: List[str]) -> Dict[str, str]:
    result = execute_arango_query(
        db=get_db(arango_client),
        query=_get_mesh_by_ids_query(),
        ids=mesh_ids
    )
    return {row['mesh_id']: row['mesh_name'] for row in result}


def _get_nodes_from_node_ids(
    arango_client: ArangoClient,
    entity_type: str,
    node_ids: List[str]
) -> Dict[str, str]:
    result = execute_arango_query(
        db=get_db(arango_client),
        query=get_docs_by_ids_query(entity_type),
        ids=node_ids
    )
    return {row['entity_id']: row['entity_name'] for row in result}

def get_primary_names(annotations):
    """Copied from AnnotationService.add_primary_name
    """
    chemical_ids = set()
    compound_ids = set()
    disease_ids = set()
    gene_ids = set()
    protein_ids = set()
    organism_ids = set()
    mesh_ids = set()

    arango_client = get_or_create_arango_client()
    updated_annotations = []

    # Note: We need to split the ids by colon because
    # we prepend the database source prefix
    # in the KG most of these ids do not have those prefix

    for anno in annotations:
        if not anno.get('primaryName'):
            # a custom annotation had a list in ['meta']['type']
            # probably a leftover from previous change
            if type(anno['meta']['type']) == list:
                anno['meta']['type'] = anno['meta']['type'][0]

            if anno['meta']['type'] in {
                EntityType.COMPOUND.value,
                EntityType.GENE.value,
                EntityType.PROTEIN.value,
                EntityType.SPECIES.value
            } and ':' in anno['meta']['id']:
                meta_id = anno['meta']['id'].split(':')[1]
            else:
                meta_id = anno['meta']['id']

            if anno['meta']['type'] == EntityType.ANATOMY.value or anno['meta']['type'] == EntityType.FOOD.value:  # noqa
                mesh_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.CHEMICAL.value:
                chemical_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.COMPOUND.value:
                compound_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.DISEASE.value:
                disease_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.GENE.value:
                gene_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.PROTEIN.value:
                protein_ids.add(meta_id)
            elif anno['meta']['type'] == EntityType.SPECIES.value:
                organism_ids.add(meta_id)

    try:
        chemical_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.CHEMICAL.value,
            list(chemical_ids)
        )
        compound_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.COMPOUND.value,
            list(compound_ids)
        )
        disease_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.DISEASE.value,
            list(disease_ids)
        )
        gene_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.GENE.value,
            list(gene_ids)
        )
        protein_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.PROTEIN.value,
            list(protein_ids)
        )
        organism_names = _get_nodes_from_node_ids(
            arango_client,
            EntityType.SPECIES.value,
            list(organism_ids)
        )
        mesh_names = _get_mesh_from_mesh_ids(arango_client, list(mesh_ids))
    except Exception:
        raise

    for anno in annotations:
        if not anno.get('primaryName'):
            if anno['meta']['type'] in {
                EntityType.COMPOUND.value,
                EntityType.GENE.value,
                EntityType.PROTEIN.value,
                EntityType.SPECIES.value
            } and ':' in anno['meta']['id']:
                meta_id = anno['meta']['id'].split(':')[1]
            else:
                meta_id = anno['meta']['id']

            try:
                if anno['meta']['type'] == EntityType.ANATOMY.value or anno['meta']['type'] == EntityType.FOOD.value:  # noqa
                    anno['primaryName'] = mesh_names[meta_id]
                elif anno['meta']['type'] == EntityType.CHEMICAL.value:
                    anno['primaryName'] = chemical_names[meta_id]
                elif anno['meta']['type'] == EntityType.COMPOUND.value:
                    anno['primaryName'] = compound_names[meta_id]
                elif anno['meta']['type'] == EntityType.DISEASE.value:
                    anno['primaryName'] = disease_names[meta_id]
                elif anno['meta']['type'] == EntityType.GENE.value:
                    anno['primaryName'] = gene_names[meta_id]
                elif anno['meta']['type'] == EntityType.PROTEIN.value:
                    anno['primaryName'] = protein_names[meta_id]
                elif anno['meta']['type'] == EntityType.SPECIES.value:
                    anno['primaryName'] = organism_names[meta_id]
                else:
                    if anno.get('keyword'):
                        anno['primaryName'] = anno['keyword']
                    elif anno.get('meta', {}).get('allText'):
                        # custom annotations
                        anno['primaryName'] = anno['meta']['allText']
                    else:
                        anno['primaryName'] = ''
            except KeyError:
                # just keep what is already there or use the
                # synonym if blank
                if not anno.get('primaryName'):
                    if anno.get('keyword'):
                        anno['primaryName'] = anno['keyword']
                    elif anno.get('meta', {}).get('allText'):
                        # custom annotations
                        anno['primaryName'] = anno['meta']['allText']
                    else:
                        anno['primaryName'] = ''
        updated_annotations.append(anno)
    return updated_annotations


def update_annotations_add_primary_name(file_id, bioc):
    if not bioc:
        return

    annotations = bioc['documents'][0]['passages'][0]['annotations']

    bioc['documents'][0]['passages'][0]['annotations'] = get_primary_names(annotations)
    return {'id': file_id, 'annotations': bioc}


def update_custom_annotations_add_primary_name(file_id, annotations):
    if not annotations:
        return

    custom = get_primary_names(annotations)
    return {'id': file_id, 'custom_annotations': custom}


def update_annotations(results, session, func):
    try:
        for chunk in window_chunk(results):
            with mp.Pool(processes=4) as pool:
                updated = pool.starmap(
                    func,
                    [
                        (result.id, result.annotations) for result in chunk
                    ]
                )
                session.bulk_update_mappings(Files, updated)
                session.commit()
    except Exception:
        raise Exception('Migration failed.')


def update_custom_annotations(results, session, func):
    try:
        for chunk in window_chunk(results):
            with mp.Pool(processes=4) as pool:
                updated = pool.starmap(
                    func,
                    [
                        (result.id, result.custom_annotations) for result in chunk
                    ]
                )
                session.bulk_update_mappings(Files, updated)
                session.commit()
    except Exception:
        raise Exception('Migration failed.')
