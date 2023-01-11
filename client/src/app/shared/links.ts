import { unary, mapValues } from 'lodash-es';

import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { AppURL } from './utils/url';

interface LinkEntity {
  label: string;
  url: string;
  search: (query: string) => AppURL;
}

export const LINKS = mapValues(
  {
    ncbi_taxonomy: {
      label: 'NCBI Taxonomy',
      url: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi',
      search: (id: string) => new AppURL(this.url).update({search: {id}}),
    },
    ncbi_gene: {
      label: 'NCBI Gene',
      url: 'https://www.ncbi.nlm.nih.gov/gene/',
      search: (term: string) => new AppURL(this.url).update({search: {term}}),
    },
    uniprot: {
      label: 'UniProt',
      url: 'https://www.uniprot.org/uniprotkb',
      search: (query: string) => new AppURL(this.url).update({search: {query}}),
    },
    mesh: {
      label: 'MeSH',
      url: 'https://www.ncbi.nlm.nih.gov/mesh/',
      search: (term: string) => new AppURL(this.url).update({search: {term}}),
    },
    chebi: {
      label: 'ChEBI',
      url: 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do',
      search: (searchString: string) => new AppURL(this.url).update({search: {searchString}}),
    },
    pubchem: {
      label: 'PubChem',
      url: 'https://pubchem.ncbi.nlm.nih.gov/',
      search: (query: string) => new AppURL(this.url).update({fragment: new URLSearchParams({query})}),
    },
    wikipedia: {
      label: 'Wikipedia',
      url: 'https://www.google.com/search',
      search: (q: string) => new AppURL(this.url).update({search: {q: 'site:+wikipedia.org+' + q}}),
    },
    google: {
      label: 'Google',
      url: 'https://www.google.com/search',
      search: (q: string) => new AppURL(this.url).update({search: {q}}),
    },
  } as Record<string, LinkEntity>,
  le => Object.freeze(le)
);
