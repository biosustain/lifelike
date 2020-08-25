import { Hyperlink } from '../drawing-tool/services/interfaces';

export const SEARCH_LINKS: readonly Hyperlink[] = Object.freeze([{
  domain: 'NCBI',
  url: 'https://www.ncbi.nlm.nih.gov/gene/?term=%s',
}, {
  domain: 'UniProt',
  url: 'https://www.uniprot.org/uniprot/?sort=score&query=%s',
}, {
  domain: 'Wikipedia',
  url: 'https://www.google.com/search?q=site:+wikipedia.org+%s',
}, {
  domain: 'Google',
  url: 'https://www.google.com/search?q=%s',
}].map(item => Object.freeze(item)));
