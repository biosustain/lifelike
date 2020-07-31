import { FTSQueryRecord } from '../../interfaces';

const DOMAINS_URL = {
  CHEBI: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
  MESH: 'https://www.ncbi.nlm.nih.gov/mesh/?term=',
  UniProt: 'https://www.uniprot.org/uniprot/',
  GO: 'http://amigo.geneontology.org/amigo/term/',
  NCBI_Gene: 'https://www.ncbi.nlm.nih.gov/gene/',
  NCBI_Taxonomy: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
};

export function getLink(data: FTSQueryRecord) {
  const domain = getDomain(data.node.subLabels);
  const type = getType(data.node.subLabels);
  if (domain === 'NCBI' && type === 'Gene') {
    return DOMAINS_URL[domain + '_' + type] + data.node.data.id;
  } else if (domain === 'NCBI' && type === 'Taxonomy') {
    return DOMAINS_URL[domain + '_' + type] + data.node.data.id;
  } else if (domain === 'GO' || domain === 'UniProt') {
    return DOMAINS_URL[domain] + data.node.data.id;
  } else {
    return DOMAINS_URL[domain] + data.node.data.id.split(':')[1];
  }
}

function getDomain(subLabels: string[]) {
  removeUnneededLabels(subLabels);
  return subLabels.find(element => element.match(/^db_*/))
    .split('_')[1];
}

function removeUnneededLabels(subLabels: string[]) {
  const tobeRemovedLabels = ['db_Literature', 'TopicalDescriptor'];
  tobeRemovedLabels.forEach(label => {
    const index = subLabels.indexOf(label);
    if (index !== -1) {
      subLabels.splice(index, 1);
    }
  });
}

function getType(subLabels: string[]) {
  removeUnneededLabels(subLabels);
  return subLabels.find(element => !element.match(/^db_*/));
}
