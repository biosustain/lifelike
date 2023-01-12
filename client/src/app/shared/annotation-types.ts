import { annotationTypesMap } from 'app/shared/annotation-styles';

import { BIOCYC, CHEBI2, NCBI, UNIPROT } from './url/constants';
import { HttpURL } from './url/url';

export enum DatabaseType {
  MESH = 'MeSH',
  BIOCYC = 'BioCyc',
  CHEBI = 'ChEBI',
  NCBI_GENE = 'NCBI Gene',
  NCBI_TAXONOMY = 'NCBI Taxonomy',
  UNIPROT = 'UniProt',
  PUBCHEM = 'PubChem',
}

export interface DatabaseLink {
  name: string;
  url: (id: string) => HttpURL;
}

export class EntityType {
  id: string;

  constructor(
    public name: string,
    public color: string,
    public sources: string[],
    public links: DatabaseLink[]
  ) {
    this.id = name;
  }
}

export const ENTITY_TYPES = [
  new EntityType(
    'Anatomy',
    annotationTypesMap.get('anatomy').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: NCBI.mesh} as DatabaseLink]
  ),
  new EntityType(
    'Chemical',
    annotationTypesMap.get('chemical').color,
    [DatabaseType.CHEBI, DatabaseType.PUBCHEM],
    [{name: DatabaseType.CHEBI, url: CHEBI2.search} as DatabaseLink]
  ),
  new EntityType('Company', annotationTypesMap.get('company').color, [], [{} as DatabaseLink]),
  new EntityType(
    'Compound',
    annotationTypesMap.get('compound').color,
    [DatabaseType.BIOCYC],
    [{name: DatabaseType.BIOCYC, url: BIOCYC.compound} as DatabaseLink]
  ),
  new EntityType(
    'Disease',
    annotationTypesMap.get('disease').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: NCBI.mesh} as DatabaseLink]
  ),
  new EntityType('Entity', annotationTypesMap.get('entity').color, [], [{} as DatabaseLink]),
  new EntityType(
    'Food',
    annotationTypesMap.get('food').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: NCBI.mesh} as DatabaseLink]
  ),
  new EntityType(
    'Gene',
    annotationTypesMap.get('gene').color,
    [DatabaseType.NCBI_GENE, DatabaseType.BIOCYC],
    [
      {name: DatabaseType.NCBI_GENE, url: NCBI.gene} as DatabaseLink,
      {name: DatabaseType.BIOCYC, url: BIOCYC.gene} as DatabaseLink
    ]
  ),
  new EntityType(
    'Lab Sample',
    annotationTypesMap.get('lab sample').color,
    [],
    [{} as DatabaseLink]
  ),
  new EntityType(
    'Lab Strain',
    annotationTypesMap.get('lab strain').color,
    [],
    [{} as DatabaseLink]
  ),
  new EntityType('Mutation', annotationTypesMap.get('mutation').color, [], [{} as DatabaseLink]),
  new EntityType('Pathway', annotationTypesMap.get('pathway').color, [], [{} as DatabaseLink]),
  new EntityType(
    'Phenomena',
    annotationTypesMap.get('phenomena').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: NCBI.mesh} as DatabaseLink]
  ),
  new EntityType(
    'Phenotype',
    annotationTypesMap.get('phenotype').color,
    [DatabaseType.MESH],
    [{name: DatabaseType.MESH, url: NCBI.mesh} as DatabaseLink]
  ),
  new EntityType(
    'Protein',
    annotationTypesMap.get('protein').color,
    [DatabaseType.UNIPROT],
    [{name: DatabaseType.UNIPROT, url: UNIPROT.search} as DatabaseLink]
  ),
  new EntityType(
    'Species',
    annotationTypesMap.get('species').color,
    [DatabaseType.NCBI_TAXONOMY],
    [{name: DatabaseType.NCBI_TAXONOMY, url: NCBI.taxonomy} as DatabaseLink]
  ),
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
