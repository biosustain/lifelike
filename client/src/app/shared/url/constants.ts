import { HttpURL } from '.';

export const NCBI = Object.freeze({
  url: new HttpURL('https://www.ncbi.nlm.nih.gov/').freeze(),
  article: (id: string | number | boolean, file?: string | number | boolean) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['pmc', 'articles', `PMC${id}`, ...(file ? ['bin', file] : [])],
    }),
  pubmed: (pmid: string | number | boolean) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['pubmed', pmid],
    }),
  gene: (eid: string | number | boolean) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['gene', eid],
    }),
  taxonomy: (id: string | number | boolean) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['Taxonomy', 'Browser', 'wwwtax.cgi'],
      search: { id: String(id) },
    }),
  mesh: (term: string) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['mesh'],
      search: { term },
    }),
  pubtator: (id: string) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['research', 'pubtator'],
    }),
  pubtatorSearch: (searchTerm: string) =>
    new HttpURL(NCBI.url, {
      pathSegments: ['research', 'pubtator'],
      search: { view: 'docsum', query: searchTerm },
    }),
});

export const UNIPROT = Object.freeze({
  url: new HttpURL('https://www.uniprot.org/uniprotkb').freeze(),
  search: (query: string) =>
    new HttpURL(UNIPROT.url, {
      search: { query },
    }),
});

export const GO = Object.freeze({
  url: new HttpURL('http://amigo.geneontology.org/').freeze(),
  id: (eid: string) =>
    new HttpURL(GO.url, {
      pathSegments: ['amigo', 'term', `GO:${eid}`],
    }),
  search: (q: string) =>
    new HttpURL(GO.url, {
      pathSegments: ['amigo', 'search', 'annotation'],
      search: { q },
    }),
});

export const BIOCYC = Object.freeze({
  url: new HttpURL('https://biocyc.org/').freeze(),
  id: (object: string) =>
    new HttpURL(BIOCYC.url, {
      pathSegments: ['ECOLI', 'NEW-IMAGE'],
      search: { object },
    }),
  compound: (id: string) =>
    new HttpURL(BIOCYC.url, {
      pathSegments: ['compound'],
      search: { orgid: 'META', id },
    }),
  gene: (id: string, orgid = 'PPUT160488') =>
    new HttpURL(BIOCYC.url, {
      pathSegments: ['gene'],
      search: { orgid, id },
    }),
});

export const REACTOME = Object.freeze({
  url: new HttpURL('https://reactome.org/').freeze(),
  id: (stId: string) =>
    new HttpURL(REACTOME.url, {
      pathSegments: ['content', 'detail', stId],
    }),
});

export const CHEBI = Object.freeze({
  url: new HttpURL('http://identifiers.org/').freeze(),
  id: (eid: string) =>
    new HttpURL(CHEBI.url, {
      pathSegments: ['chebi', `CHEBI:${eid}`],
    }),
});

export const CHEBI2 = Object.freeze({
  url: new HttpURL('https://www.ebi.ac.uk/').freeze(),
  search: (chebiId: string) =>
    new HttpURL(CHEBI2.url, {
      pathSegments: ['chebi', 'searchId.do'],
      search: { chebiId },
    }),
  advancedSearch: (searchString: string) =>
    new HttpURL(CHEBI2.url, {
      pathSegments: ['chebi', 'advancedSearchFT.do'],
      search: { searchString },
    }),
});

export const MESHB = Object.freeze({
  url: new HttpURL('https://meshb.nlm.nih.gov/').freeze(),
  id: (ui: string) =>
    new HttpURL(MESHB.url, {
      pathSegments: ['record', `ui`],
      search: { ui },
    }),
});

export const PUBCHEM = Object.freeze({
  url: new HttpURL('https://pubchem.ncbi.nlm.nih.gov/').freeze(),
  search: (query: string) =>
    new HttpURL(PUBCHEM.url, {
      fragment: new URLSearchParams({ query }),
    }),
});

export const GOOGLE = Object.freeze({
  url: new HttpURL('https://www.google.com/search').freeze(),
  search: (q: string) =>
    new HttpURL(GOOGLE.url, {
      search: { q },
    }),
  searchWikipedia: (q: string) =>
    new HttpURL(GOOGLE.url, {
      search: { q: 'site:+wikipedia.org+' + q },
    }),
});
