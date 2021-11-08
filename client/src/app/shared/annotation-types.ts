import { annotationTypesMap } from 'app/shared/annotation-styles';

export enum DatabaseType {
  MESH = 'MeSH',
  BIOCYC = 'BioCyc',
  CHEBI = 'ChEBI',
  NCBI_GENE = 'NCBI Gene',
  NCBI_TAXONOMY = 'NCBI Taxonomy',
  UNIPROT = 'UniProt',
  PUBCHEM = 'PubChem',
  NONE = ''
}

export interface DatabaseLinks {
  name: string;
  url: string;
}

export class EntityType {
  id: string;

  constructor(public name: string,
              public color: string,
              public sources: string[],
              public links: DatabaseLinks[]) {
    this.id = name;
  }
}

export const ENTITY_TYPES = [
  new EntityType(
    'Anatomy',
    annotationTypesMap.get('anatomy').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: 'https://www.ncbi.nlm.nih.gov/mesh/'} as DatabaseLinks]
  ),
  new EntityType(
    'Chemical',
    annotationTypesMap.get('chemical').color,
    [DatabaseType.CHEBI, DatabaseType.PUBCHEM],
    [{name: DatabaseType.CHEBI, url: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId='} as DatabaseLinks]
  ),
  new EntityType(
    'Company',
    annotationTypesMap.get('company').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Compound',
    annotationTypesMap.get('compound').color,
    [DatabaseType.BIOCYC],
    [{name: DatabaseType.BIOCYC, url: 'https://biocyc.org/compound?orgid=META&id='} as DatabaseLinks]
  ),
  new EntityType(
    'Disease',
    annotationTypesMap.get('disease').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: 'https://www.ncbi.nlm.nih.gov/mesh/'} as DatabaseLinks]
  ),
  new EntityType(
    'Entity',
    annotationTypesMap.get('entity').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Food',
    annotationTypesMap.get('food').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: 'https://www.ncbi.nlm.nih.gov/mesh/'} as DatabaseLinks]
  ),
  new EntityType(
    'Gene',
    annotationTypesMap.get('gene').color,
    [DatabaseType.NCBI_GENE, DatabaseType.BIOCYC],
    [
      {name: DatabaseType.NCBI_GENE, url: 'https://www.ncbi.nlm.nih.gov/gene/'} as DatabaseLinks,
      {name: DatabaseType.BIOCYC, url: 'https://biocyc.org/gene?orgid=PPUT160488&id='} as DatabaseLinks
    ]
  ),
  new EntityType(
    'Lab Sample',
    annotationTypesMap.get('lab sample').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Lab Strain',
    annotationTypesMap.get('lab strain').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Mutation',
    annotationTypesMap.get('mutation').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Pathway',
    annotationTypesMap.get('pathway').color,
    [DatabaseType.NONE],
    [{} as DatabaseLinks]
  ),
  new EntityType(
    'Phenomena',
    annotationTypesMap.get('phenomena').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: 'https://www.ncbi.nlm.nih.gov/mesh/'} as DatabaseLinks]
  ),
  new EntityType(
    'Phenotype',
    annotationTypesMap.get('phenotype').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: 'https://www.ncbi.nlm.nih.gov/mesh/'} as DatabaseLinks]
  ),
  new EntityType(
    'Protein',
    annotationTypesMap.get('protein').color,
    [DatabaseType.UNIPROT],
    [{name: DatabaseType.UNIPROT, url: 'https://www.uniprot.org/uniprot/?sort=score&query='} as DatabaseLinks]
  ),
  new EntityType(
    'Species',
    annotationTypesMap.get('species').color,
    [DatabaseType.NCBI_TAXONOMY],
    [{name: DatabaseType.NCBI_TAXONOMY, url: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id='} as DatabaseLinks]
  ),
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
