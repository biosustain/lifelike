import multiprocessing as mp

from neo4japp.models import Files
from neo4japp.services.annotations import AnnotationGraphService
from neo4japp.services.annotations.constants import EntityType


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

    neo4j = AnnotationGraphService()
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

    chemical_names = neo4j.get_chemicals_from_chemical_ids(list(chemical_ids))
    compound_names = neo4j.get_compounds_from_compound_ids(list(compound_ids))
    disease_names = neo4j.get_diseases_from_disease_ids(list(disease_ids))
    gene_names = neo4j.get_genes_from_gene_ids(list(gene_ids))
    protein_names = neo4j.get_proteins_from_protein_ids(list(protein_ids))
    organism_names = neo4j.get_organisms_from_organism_ids(list(organism_ids))
    mesh_names = neo4j.get_mesh_from_mesh_ids(list(mesh_ids))

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
