export const NODE_EXPANSION_LIMIT = 500;
export const NODE_EXPANSION_CLUSTERING_RECOMMENDATION = 200;
export const SNIPPET_RESULT_LIMIT = 10000;
export const SNIPPET_PAGE_LIMIT = 25;
export const PUBMEDURL = 'https://pubmed.ncbi.nlm.nih.gov/';

export const VIZ_SEARCH_LIMIT = 10;

export enum Hyperlink {
  Chebi = 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
  Mesh = 'https://www.ncbi.nlm.nih.gov/mesh/',
  Uniprot = 'https://www.uniprot.org/uniprot/?sort=score&query=',
  NcbiGenes = 'https://www.ncbi.nlm.nih.gov/gene/',
  NcbiSpecies = 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
  Go = 'http://amigo.geneontology.org/amigo/term/'
}

export enum DBHostname {
  ChEBI = 'www.ebi.ac.uk',
  UniProt = 'www.uniprot.org',
  NCBI = 'www.ncbi.nlm.nih.gov',
  GO = 'amigo.geneontology.org'
}

export enum AnnotationType {
  Chemical = 'Chemical',
  Compound = 'Compound',
  Disease = 'Disease',
  Gene = 'Gene',
  Protein = 'Protein',
  Species = 'Species',
  Phenotype = 'Phenotype',
  Company = 'Company',
  Mutation = 'Mutation',
  Pathway = 'Pathway',
  Entity = 'Entity',
}

export enum DatabaseType {
  Chebi = 'CHEBI',
  Mesh = 'MESH',
  Uniprot = 'UNIPROT',
  Ncbi = 'NCBI',
  Biocyc = 'BIOCYC',
}

export const LOGOUT_SUCCESS = '[Auth] Logout Success';

/** API response that contains the following message is
 * used as a flag to determine a user's course of action
 * within the auth-interceptors.
 */
export const JWT_AUTH_TOKEN_EXPIRED = 'auth token has expired';
export const JWT_AUTH_TOKEN_INVALID = 'auth token is invalid';
export const JWT_REFRESH_TOKEN_EXPIRED = 'refresh token has expired';
export const JWT_REFRESH_TOKEN_INVALID = 'refresh token is invalid';

export const LINK_NODE_ICON_OBJECT = {
  face: 'FontAwesome',
  weight: 'bold', // Font Awesome 5 doesn't work properly unless bold.
  code: '\uf15b',
  size: 50,
  color: '#669999',
};

export const DEFAULT_CLUSTER_ROWS = 5;
