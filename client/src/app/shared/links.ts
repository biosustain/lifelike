import { Hyperlink } from '../drawing-tool/services/interfaces';

export const SEARCH_LINKS: readonly Hyperlink[] = Object.freeze([{
  domain: 'NCBI',
  url: 'https://www.ncbi.nlm.nih.gov/gene/?term=%s',
}, {
  domain: 'UniProt',
  url: 'https://www.uniprot.org/uniprot/?sort=score&query=%s',
}, {
  domain: 'Mesh',
  url: 'https://www.ncbi.nlm.nih.gov/mesh/?term=%s',
}, {
  domain: 'ChEBI',
  url: 'https://www.google.com/search?q=site:ebi.ac.uk/+%s',
}, {
  domain: 'PubCHem',
  url: 'https://www.google.com/search?q=site:ncbi.nlm.nih.gov/+%s',
}, {
  domain: 'Wikipedia',
  url: 'https://www.google.com/search?q=site:+wikipedia.org+%s',
}, {
  domain: 'Google',
  url: 'https://www.google.com/search?q=%s',
}].map(item => Object.freeze(item)));
