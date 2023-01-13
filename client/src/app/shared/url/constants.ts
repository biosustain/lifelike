import { HttpURL } from '.';

export const NCBI = Object.freeze({
  url: new HttpURL('https://www.ncbi.nlm.nih.gov/'),
  article: (id: string, file?: string) => new HttpURL(this.url, {
    pathSegments: [ 'pmc', 'articles', `PMC${id}`, ...(file ? ['bin', file] : []) ],
  }),
  pubmed: (pmid: string) => new HttpURL(this.url, {
    pathSegments: [ 'pubmed', pmid ],
  }),
  gene: (eid: string) => new HttpURL(this.url, {
    pathSegments: [ 'gene', eid ],
  }),
  taxonomy: (id: string) => new HttpURL(this.url, {
    pathSegments: [ 'Taxonomy', 'Browser', 'wwwtax.cgi' ],
    search: {id},
  }),
  mesh: (term: string) => new HttpURL(this.url, {
    pathSegments: [ 'mesh' ],
    search: {term},
  }),
  pubtator: (id: string) => new HttpURL(this.url, {
    pathSegments: [ 'research', 'pubtator' ],
  }),
  pubtatorSearch: (searchTerm: string) => new HttpURL(this.url, {
    pathSegments: [ 'research', 'pubtator' ],
    search: {view: 'docsum', query: searchTerm},
  }),
});

export const UNIPROT = Object.freeze({
  url: new HttpURL('https://www.uniprot.org/uniprotkb'),
  search: (query: string) => new HttpURL(this.url, {
    search: {query}
  }),
});

export const GO = Object.freeze({
  url: new HttpURL('http://amigo.geneontology.org/'),
  id: (eid: string) => new HttpURL(this.url, {
    pathSegments: ['amigo', 'term', `GO:${eid}`],
  }),
  search: (q: string) => new HttpURL(this.url, {
    pathSegments: ['amigo', 'search', 'annotation'],
    search: {q},
  }),
});

export const BIOCYC = Object.freeze({
  url: new HttpURL('https://biocyc.org/'),
  id: (object: string) => new HttpURL(this.url, {
    pathSegments: ['ECOLI', 'NEW-IMAGE'],
    search: {object},
  }),
  compound: (id: string) => new HttpURL(this.url, {
    pathSegments: ['compound'],
    search: {orgid: 'META', id},
  }),
  gene: (id: string, orgid = 'PPUT160488') => new HttpURL(this.url, {
    pathSegments: ['gene'],
    search: {orgid, id},
  }),
});

export const REACTOME = Object.freeze({
  url: new HttpURL('https://reactome.org/'),
  id: (stId: string) => new HttpURL(this.url, {
    pathSegments: ['content', 'detail', stId],
  }),
});

export const CHEBI = Object.freeze({
  url: new HttpURL('http://identifiers.org/'),
  id: (eid: string) => new HttpURL(this.url, {
    pathSegments: ['chebi', `CHEBI:${eid}`],
  }),
});

export const CHEBI2 = Object.freeze({
  url: new HttpURL('https://www.ebi.ac.uk/'),
  search: (chebiId: string) => new HttpURL(this.url, {
    pathSegments: ['chebi', 'searchId.do'],
    search: {chebiId},
  }),
  advancedSearch: (searchString: string) => new HttpURL(this.url, {
    pathSegments: ['chebi', 'advancedSearchFT.do'],
    search: {searchString},
  }),
});

export const MESHB = Object.freeze({
  url: new HttpURL('https://meshb.nlm.nih.gov/'),
  id: (ui: string) => new HttpURL(this.url, {
    pathSegments: ['record', `ui`],
    search: {ui},
  }),
});

export const PUBCHEM = Object.freeze({
  url: new HttpURL('https://pubchem.ncbi.nlm.nih.gov/'),
  search: (query: string) => new HttpURL(this.url, {
    fragment: new URLSearchParams({query}),
  }),
});

export const GOOGLE = Object.freeze({
  url: new HttpURL('https://www.google.com/search'),
  search: (q: string) => new HttpURL(this.url, {
    search: {q},
  }),
  searchWikipedia: (q: string) => new HttpURL(this.url, {
    search: {q: 'site:+wikipedia.org+' + q},
  }),
});
