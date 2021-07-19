import { Hyperlink } from '../drawing-tool/services/interfaces';

export const SEARCH_LINKS: readonly Hyperlink[] = Object.freeze([{
  domain: 'NCBI_Taxonomy',
  url: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=%s',
  isDatabase: true,
}, {
  domain: 'NCBI',
  url: 'https://www.ncbi.nlm.nih.gov/gene/?term=%s',
  isDatabase: true,
}, {
  domain: 'UniProt',
  url: 'https://www.uniprot.org/uniprot/?sort=score&query=%s',
  isDatabase: true,
}, {
  domain: 'Mesh',
  url: 'https://www.ncbi.nlm.nih.gov/mesh/?term=%s',
  isDatabase: true,
}, {
  domain: 'ChEBI',
  url: 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=%s',
  isDatabase: true,
}, {
  domain: 'PubChem',
  url: 'https://pubchem.ncbi.nlm.nih.gov/#query=%s',
  isDatabase: true,
}, {
  domain: 'Wikipedia',
  url: 'https://www.google.com/search?q=site:+wikipedia.org+%s',
  isDatabase: false,
}, {
  domain: 'Google',
  url: 'https://www.google.com/search?q=%s',
  isDatabase: false,
}].map(item => Object.freeze(item)));
