import { Observable, of } from 'rxjs';
import { mapBlobToBuffer, mapBufferToJson } from '../../shared/utils/files';
import { map, mergeMap } from 'rxjs/operators';
import {
  EnrichmentTableService,
  EnrichmentWrapper,
  GoNode,
  NCBINode,
  NCBIWrapper,
} from '../services/enrichment-table.service';
import { nullCoalesce } from '../../shared/utils/types';

export class EnrichmentDocument {
  taxID = '';
  organism = '';
  importGenes: string[] = [];
  domains: string[] = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'Biocyc',
  ];
  result: EnrichmentResult = null;
  duplicateGenes: string[] = [];

  constructor(protected readonly worksheetViewerService: EnrichmentTableService) {
  }

  setParameters(importGenes: string[], taxID: string, organism: string, domains?: string[]) {
    // parse the file content to get gene list and organism tax id and name
    const rawImportGenes = importGenes.map(gene => gene.trim()).filter((gene) => gene !== '');
    if (taxID === '562' || taxID === '83333') {
      taxID = '511145';
    } else if (taxID === '4932') {
      taxID = '559292';
    }

    // parse for column order/domain input
    if (domains == null) {
      domains = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
    }

    const [uniqueImportGenes, duplicateGenes] = this.removeDuplicates(rawImportGenes);

    // We set these all at the end to be thread/async-safe
    this.importGenes = uniqueImportGenes;
    this.taxID = taxID;
    this.organism = organism;
    this.domains = domains;
    this.duplicateGenes = duplicateGenes;
  }

  /**
   * Remove any duplicates from the import gene list and populate duplicate list
   * @param arr string of gene names
   */
  private removeDuplicates(arr: string[]): [string[], string[]] {
    const duplicateArray = new Set<string>();
    const uniqueArray = new Set<string>();
    for (const item of arr) {
      if (uniqueArray.has(item)) {
        duplicateArray.add(item);
      } else {
        uniqueArray.add(item);
      }
    }
    return [Array.from(uniqueArray), Array.from(duplicateArray)];
  }

  load(blob: Blob): Observable<this> {
    return of(blob)
      .pipe(
        mapBlobToBuffer(),
        mapBufferToJson<EnrichmentData>(),
        mergeMap((data: EnrichmentData): Observable<this> => {
          // parse the file content to get gene list and organism tax id and name
          const resultArray = data.data.split('/');
          const importGenes = resultArray[0].split(',');
          const taxID = resultArray[1];
          const organism = resultArray[2];
          const domains = resultArray.length > 3 ? resultArray[3].split(',') : null;
          this.setParameters(importGenes, taxID, organism, domains);

          return (data.result ? of(data.result) : this.generateEnrichmentResults(domains, importGenes, taxID))
            .pipe(
              map((newResult: EnrichmentResult) => {
                // We set these all at the end to be thread/async-safe
                this.result = newResult;
                return this;
              }),
            );
        }),
      );
  }

  save(): Observable<Blob> {
    const data: EnrichmentData = {
      data: [
        this.importGenes.join(','),
        this.taxID,
        this.organism,
        this.domains.join(','),
      ].join('/'),
      ...(this.result != null ? {
        result: this.result,
      } : {}),
    };

    return of(new Blob([JSON.stringify(data)]));
  }

  refreshData(): Observable<this> {
    this.result = null;
    return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
      map((result: EnrichmentResult) => {
        this.result = result;
        return this;
      }),
    );
  }

  private generateEnrichmentResults(domains: string[], importGenes: string[],
                                    taxID: string): Observable<EnrichmentResult> {
    return this.worksheetViewerService
      .matchNCBINodes(importGenes, taxID)
      .pipe(
        mergeMap((ncbiNodesData: NCBIWrapper[]) => {
          const ncbiIds = ncbiNodesData.map((wrapper) => wrapper.neo4jID);
          return this.worksheetViewerService
            .getNCBIEnrichmentDomains(ncbiIds, taxID)
            .pipe(
              map((domainResults: EnrichmentWrapper[]): EnrichmentResult => {
                const synonyms = ncbiNodesData.map((wrapper) => wrapper.s.name);
                const synonymsSet = new Set<string>(synonyms);
                const ncbiNodes = ncbiNodesData.map((wrapper) => wrapper.x);
                const ncbiLinks = ncbiNodesData.map((wrapper) => wrapper.link);

                const geneMap: Map<string, EnrichedGene> = new Map();

                // Add ncbi and imported gene name columns to relevant columns (left of domains)
                for (let i = 0; i < ncbiNodes.length; i++) {
                  geneMap.set(synonyms[i], {
                    imported: synonyms[i],
                    matched: ncbiNodes[i].name,
                    fullName: ncbiNodes[i].full_name,
                    link: ncbiLinks[i],
                    domains: this.generateGeneDomainResults(domains, domainResults[i], ncbiNodes, ncbiIds),
                  });
                }

                for (const gene of importGenes) {
                  if (!synonymsSet.has(gene)) {
                    geneMap.set(gene, {
                      imported: gene,
                    });
                  }
                }

                return {
                  version: '1',
                  domainInfo: {
                    Regulon: {
                      labels: ['Regulator Family', 'Activated By', 'Repressed By'],
                    },
                    UniProt: {labels: ['Function']},
                    String: {labels: ['Annotation']},
                    GO: {labels: ['Annotation']},
                    Biocyc: {labels: ['Pathways']},
                  },
                  genes: [...geneMap.values()],
                };
              }),
            );
        }),
      );
  }

  /**
   * Process wrapper to convert domain data into string array that represents domain columns.
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param domains requested domains
   * @param wrapper data returned from get domains request
   * @param ncbiNodes matched ncbi data
   * @param ncbiIds matched ncbi ids
   * @returns table entries
   */
  private generateGeneDomainResults(domains: string[], wrapper: EnrichmentWrapper,
                                    ncbiNodes: NCBINode[], ncbiIds: number[]): { [domain: string]: EnrichedGeneDomain } {
    const results: { [domain: string]: EnrichedGeneDomain } = {};

    if (domains.includes('Regulon')) {
      if (wrapper.regulon.result != null) {
        results.Regulon = {
          'Regulator Family': {
            text: nullCoalesce(wrapper.regulon.result.regulator_family, ''),
            link: wrapper.regulon.link,
          }, 'Activated By': {
            text: wrapper.regulon.result.activated_by ? wrapper.regulon.result.activated_by.join('; ') : '',
            link: wrapper.regulon.link,
          }, 'Repressed By': {
            text: wrapper.regulon.result.repressed_by ? wrapper.regulon.result.repressed_by.join('; ') : '',
            link: wrapper.regulon.link,
          },
        };
      }
    }

    if (domains.includes('UniProt')) {
      if (wrapper.uniprot.result != null) {
        results.UniProt = {
          Function: {
            text: wrapper.uniprot.result.function,
            link: wrapper.uniprot.link,
          },
        };
      }
    }

    if (domains.includes('String')) {
      if (wrapper.string.result != null) {
        results.String = {
          Annotation: {
            text: wrapper.string.result.annotation !== 'annotation not available' ?
              wrapper.string.result.annotation : '',
            link: wrapper.string.result.id ? wrapper.string.link + wrapper.string.result.id :
              wrapper.string.link + wrapper.biocyc.result.biocyc_id,
          },
        };
      }
    }

    if (domains.includes('GO')) {
      if (wrapper.go.result != null) {
        results.GO = {
          Annotation: {
            text: this.processGoWrapper(wrapper.go.result),
            link: wrapper.uniprot.result ? wrapper.go.link + wrapper.uniprot.result.id :
              'http://amigo.geneontology.org/amigo/search/annotation?q=' +
              encodeURIComponent(ncbiNodes[ncbiIds.indexOf(wrapper.node_id)].name),
          },
        };
      }
    }

    if (domains.includes('Biocyc')) {
      if (wrapper.biocyc.result != null) {
        results.Biocyc = {
          Pathways: {
            text: wrapper.biocyc.result.pathways ? wrapper.biocyc.result.pathways.join('; ') : '',
            link: wrapper.biocyc.link,
          },
        };
      }
    }

    return results;
  }

  private processGoWrapper(nodeArray: GoNode[]): string {
    if (nodeArray.length > 5) {
      return (
        nodeArray
          .map((node) => node.name)
          .slice(0, 5)
          .join('; ') + '...'
      );
    } else {
      return nodeArray
        .map((node) => node.name)
        .slice(0, 5)
        .join('; ');
    }
  }
}

export interface DomainInfo {
  labels: string[];
}

export interface DomainInfoMap {
  [domain: string]: DomainInfo;
}

export interface EnrichmentValue {
  text: string;
  annotatedText?: string;
  link: string;
}

export interface EnrichedGeneDomain {
  [label: string]: EnrichmentValue;
}

export interface EnrichedGene {
  imported: string;
  matched?: string;
  fullName?: string;
  link?: string;
  domains?: { [domain: string]: EnrichedGeneDomain };
}

export interface EnrichmentResult {
  version: '1';
  domainInfo: DomainInfoMap;
  genes: EnrichedGene[];
}

export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
  result?: EnrichmentResult;
}
