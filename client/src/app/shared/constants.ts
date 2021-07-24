export const NODE_EXPANSION_LIMIT = 500;
export const NODE_EXPANSION_CLUSTERING_RECOMMENDATION = 200;
export const SNIPPET_RESULT_LIMIT = 10000;
export const SNIPPET_PAGE_LIMIT = 25;
export const PUBMEDURL = 'https://pubmed.ncbi.nlm.nih.gov/';

export const VIZ_SEARCH_LIMIT = 10;

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

export const ORGANISM_SHORTLIST = new Map<string, string>([
  ['Escherichia coli K12 MG1655',	'511145'],
  ['Saccharomyces cerevisiae S288C',	'559292'],
  ['Pseudomonas aeruginosa PAO1',	'208964'],
  ['Clostridium difficile	Strain 630',	'272563'],
  ['Staphylococcus aureus USA300',	'367830'],
  ['Homo sapiens', '9606']
]);

export const KG_VIZ_FILTER_TYPES = [
  'Biological Process',
  'Cellular Component',
  'Chemical',
  'Disease',
  'Gene',
  'Molecular Function',
  'Protein',
  'Taxonomy'
];

export const KG_VIZ_DOMAINS = ['ChEBI', 'GO', 'Literature', 'MeSH', 'NCBI', 'UniProt'];

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 50;
