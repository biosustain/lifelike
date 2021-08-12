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

export class EntityType {
  id: string;

  constructor(public name: string,
              public color: string,
              public sources: string[]) {
    this.id = name;
  }
}

export const ENTITY_TYPES = [
  new EntityType('Anatomy', annotationTypesMap.get('anatomy').color, [DatabaseType.MESH]),
  new EntityType('Chemical', annotationTypesMap.get('chemical').color, [DatabaseType.CHEBI, DatabaseType.PUBCHEM]),
  new EntityType('Company', annotationTypesMap.get('company').color, [DatabaseType.NONE]),
  new EntityType('Compound', annotationTypesMap.get('compound').color, [DatabaseType.BIOCYC]),
  new EntityType('Disease', annotationTypesMap.get('disease').color, [DatabaseType.MESH]),
  new EntityType('Entity', annotationTypesMap.get('entity').color, [DatabaseType.NONE]),
  new EntityType('Food', annotationTypesMap.get('food').color, [DatabaseType.MESH]),
  new EntityType('Gene', annotationTypesMap.get('gene').color, [DatabaseType.NCBI_GENE]),
  new EntityType('Lab Sample', annotationTypesMap.get('lab sample').color, [DatabaseType.NONE]),
  new EntityType('Lab Strain', annotationTypesMap.get('lab strain').color, [DatabaseType.NONE]),
  new EntityType('Mutation', annotationTypesMap.get('mutation').color, [DatabaseType.NONE]),
  new EntityType('Pathway', annotationTypesMap.get('pathway').color, [DatabaseType.NONE]),
  new EntityType('Phenomena', annotationTypesMap.get('phenomena').color, [DatabaseType.MESH]),
  new EntityType('Phenotype', annotationTypesMap.get('phenotype').color, [DatabaseType.MESH]),
  new EntityType('Protein', annotationTypesMap.get('protein').color, [DatabaseType.UNIPROT]),
  new EntityType('Species', annotationTypesMap.get('species').color, [DatabaseType.NCBI_TAXONOMY]),
];

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((map, item) => {
  map[item.id] = item;
  return map;
}, {});
