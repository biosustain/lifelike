export const NODE_EXPANSION_LIMIT = 50;
export const NODE_EXPANSION_CLUSTERING_RECOMMENDATION = 200;
export const PubMedURL = 'https://pubmed.ncbi.nlm.nih.gov/';


export enum Hyperlink {
  Chebi = 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
  Mesh = 'https://www.ncbi.nlm.nih.gov/mesh/',
  Uniprot = 'https://www.uniprot.org/uniprot/',
  NcbiGenes = 'https://www.ncbi.nlm.nih.gov/gene/',
  NcbiSpecies = 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
}

export enum SearchLink {
  Ncbi = 'https://www.ncbi.nlm.nih.gov/gene/?query=',
  Uniprot = 'https://www.uniprot.org/uniprot/?sort=score&query=',
  Wikipedia = 'https://www.google.com/search?q=site:+wikipedia.org+',
  Google = 'https://www.google.com/search?q=',
}
