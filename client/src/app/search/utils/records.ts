import { FTSQueryRecord } from 'app/interfaces';
import { CHEBI2, NCBI, UNIPROT, GO } from 'app/shared/url/constants';

const DOMAINS_URL = {
  CHEBI: CHEBI2.search,
  MESH: NCBI.mesh,
  UniProt: UNIPROT.search,
  GO: GO.id,
  NCBI_Gene: NCBI.gene,
  NCBI_Taxonomy: NCBI.taxonomy,
};

export function getLink(data: FTSQueryRecord) {
  const domain = data.node.domainLabels[0].split('_')[1];
  const type = data.node.label;
  if (domain === 'NCBI' && type === 'Gene') {
    return DOMAINS_URL[domain + '_' + type](data.node.data.eid);
  } else if (domain === 'NCBI' && type === 'Taxonomy') {
    return DOMAINS_URL[domain + '_' + type](data.node.data.eid);
  } else {
    return DOMAINS_URL[domain](data.node.data.eid);
  }
}
