
const DOMAIN_MAP = new Map([
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/gene\/.+$/, 'NCBI Gene'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/Taxonomy\/.+$/, 'NCBI Taxonomy'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/mesh\/.+$/, 'MeSH'],
  [/^((https|http)(:\/\/))?(www.)?ebi.ac.uk\/.+$/, 'ChEBI'],
  [/^((https|http)(:\/\/))?(www.)?uniprot.org\/.+$/, 'UniProt'],
  [/^((https|http)(:\/\/))?(www.)?amigo.geneontology.org\/.+$/, 'GO'],
  [/^((https|http)(:\/\/))?(www.)?pubchem.ncbi.nlm.nih.gov\/.+$/, 'PubChem'],
  [/^((https|http)(:\/\/))?(www.)?biocyc.org\/.+$/, 'BioCyc'],
]);

// Match the url address with the domain
export function parseURLToDomainName(url: string, defaultReturn?: string): string {
   for (const [re, val] of DOMAIN_MAP.entries()) {
    if (re.exec(url)) {
      return val;
    }
   }
   return defaultReturn || 'Link';
}


