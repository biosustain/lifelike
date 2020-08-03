import { Domain, EntityType } from '../interfaces';

export const DOMAINS: readonly Domain[] = Object.freeze([
  Object.freeze({id: 'chebi', label: 'n:db_CHEBI', name: 'ChEBI'}),
  Object.freeze({id: 'mesh', label: 'n:db_MESH', name: 'MeSH'}),
  Object.freeze({id: 'ncbi', label: 'n:db_NCBI', name: 'NCBI'}),
  Object.freeze({id: 'go', label: 'n:db_GO', name: 'GO'}),
  Object.freeze({id: 'uniprot', label: 'n:db_UniProt', name: 'UniProt'}),
  Object.freeze({id: 'literature', label: 'n:db_Literature', name: 'Literature'}),
]);

export const DOMAIN_MAP: Map<string, Domain> = new Map(Array.from(DOMAINS.values()).map(value => [value.id, value]));

export const ENTITY_TYPES: readonly EntityType[] = Object.freeze([
  Object.freeze({id: 'gene', label: 'n:Gene', name: 'Genes'}),
  Object.freeze({id: 'chemical', label: 'n:Chemical', name: 'Chemicals'}),
  Object.freeze({id: 'disease', label: 'n:Disease', name: 'Diseases'}),
  Object.freeze({id: 'taxonomy', label: 'n:Taxonomy', name: 'Taxonomy'}),
  Object.freeze({id: 'protein', label: 'n:Protein', name: 'Proteins'}),
]);

export const ENTITY_TYPE_MAP: Map<string, EntityType> = new Map(Array.from(ENTITY_TYPES.values()).map(value => [value.id, value]));
