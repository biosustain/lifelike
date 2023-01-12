import { unary, mapValues } from 'lodash-es';

import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { CHEBI2, GOOGLE, NCBI, PUBCHEM, UNIPROT } from './url/constants';
import { HttpURL } from './url/url';

interface LinkEntity {
  label: string;
  search: (query: string) => HttpURL;
}

export const LINKS = mapValues(
  {
    ncbi_taxonomy: {
      label: 'NCBI Taxonomy',
      search: NCBI.taxonomy,
    },
    ncbi_gene: {
      label: 'NCBI Gene',
      search: NCBI.gene,
    },
    uniprot: {
      label: 'UniProt',
      search: UNIPROT.search,
    },
    mesh: {
      label: 'MeSH',
      search: NCBI.mesh,
    },
    chebi: {
      label: 'ChEBI',
      search: CHEBI2.advancedSearch
    },
    pubchem: {
      label: 'PubChem',
      search: PUBCHEM.search
    },
    wikipedia: {
      label: 'Wikipedia',
      search: GOOGLE.searchWikipedia
    },
    google: {
      label: 'Google',
      search: GOOGLE.search
    },
  } as unknown as Record<string, LinkEntity>,
  le => Object.freeze(le)
);
