import { Observable, of } from 'rxjs';
import { mapBlobToBuffer } from '../../shared/utils/files';
import { map, mergeMap } from 'rxjs/operators';
import { EnrichmentTableService, EnrichmentWrapper, GoNode, NCBINode, NCBIWrapper, } from '../services/enrichment-table.service';
import { nullCoalesce } from '../../shared/utils/types';
import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';


export class BaseEnrichmentDocument {
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
  fileId = '';

  parseParameters({
                    importGenes,
                    taxID,
                    organism,
                    domains,
                    ...rest
                  }: EnrichmentParsedData) {
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
    return {
      importGenes: uniqueImportGenes,
      taxID,
      organism,
      domains,
      duplicateGenes,
      ...rest
    };
  }

  setParameters(params) {
    // We set these all at the end to be thread/async-safe
    const parsedParams = this.parseParameters(params);
    Object.assign(this, parsedParams);
    return parsedParams;
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

  load(blob: Blob): Observable<EnrichmentParsedData> {
    return of(blob)
      .pipe(
        mapBlobToBuffer(),
        map((data: ArrayBuffer | undefined): EnrichmentData => {
          if (data == null) {
            return null;
          }
          const s = new TextDecoder('utf-8').decode(data);
          try {
            return JSON.parse(s) as EnrichmentData;
          } catch (e) {
            // Old enrichment table format was just a string for the data
            return {
              data: s,
            };
          }
        }),
        map(this.decode.bind(this)),
        map(this.setParameters.bind(this))
      );
  }

  encode({importGenes, taxID, organism, domains, result}): EnrichmentData {
    return {
      data: [
        importGenes.join(','),
        taxID,
        organism,
        domains.join(','),
      ].join('/'),
      result
    };
  }

  decode({data, ...rest}: EnrichmentData): EnrichmentParsedData {
    // parse the file content to get gene list and organism tax id and name
    const resultArray = data.split('/');
    const importGenes = resultArray[0].split(',');
    const taxID = resultArray[1];
    const organism = resultArray[2];
    const domains = resultArray.length > 3 ? resultArray[3].split(',') : null;

    return {
      importGenes, taxID, organism, domains, ...rest
    };
  }

  save(): Observable<Blob> {
    const data: EnrichmentData = this.encode(this);
    return of(new Blob([JSON.stringify(data)]));
  }
}

/****************************************
 * EnrichmentDocument subclass
 *
 * Easier to find w/ this comment block
 */
export class EnrichmentDocument extends BaseEnrichmentDocument {
  constructor(protected readonly worksheetViewerService: EnrichmentTableService) {
    super();
  }

  loadResult(blob: Blob, fileId: string): Observable<this> {
    this.fileId = fileId || '';
    return super.load(blob)
      .pipe(
        mergeMap(() => this.annotate()),
        map(() => this)
      );
  }

  refreshData(): Observable<this> {
    this.result = null;
    if (this.fileId === '') {
      // file was just created
      return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
        map((result: EnrichmentResult) => {
          this.result = result;
          return this;
        }),
      );
    } else {
      return this.worksheetViewerService.refreshEnrichmentAnnotations([this.fileId]).pipe(
        mergeMap(_ => this.annotate())
      );
    }
  }

  updateParameters(): Observable<Blob> {
    return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
      mergeMap((result: EnrichmentResult) => {
        const importGenes = this.importGenes;
        const taxID = this.taxID;
        const organism = this.organism;
        const domains = this.domains;
        const data: EnrichmentData = this.encode({importGenes, taxID, organism, domains, result});
        return of(new Blob([JSON.stringify(data)]));
      }));
  }

  private annotate(): Observable<this> {
    // retrieve annotated enrichment snippets if they exist
    return this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
      mergeMap((enriched: EnrichmentParsedData) => {
        if (Object.keys(enriched).length > 0) {
          this.result = enriched.result;
          return of(this);
        } else {
          const params = {
            organism: {
              organism_name: this.organism,
              synonym: this.organism,
              tax_id: this.taxID
            },
          } as TextAnnotationGenerationRequest;
          return this.worksheetViewerService.annotateEnrichment([this.fileId], params).pipe(
            mergeMap(() => this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
              map((annotated: EnrichmentParsedData) => {
                this.result = annotated.result;
                return this;
              })
            ))
          );
        }
      })
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
                    annotatedImported: synonyms[i],
                    matched: ncbiNodes[i].name,
                    annotatedMatched: ncbiNodes[i].name,
                    fullName: ncbiNodes[i].full_name,
                    annotatedFullName: ncbiNodes[i].full_name,
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
                  version: '3',
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
   * @param ncbiNode matched ncbi data
   * @returns table entries
   */
  private generateGeneDomainResults(domains: string[], wrapper: EnrichmentWrapper,
                                    ncbiNodes: NCBINode[], ncbiIds: number[]): { [domain: string]: EnrichedGeneDomain } {
    const results: { [domain: string]: EnrichedGeneDomain } = {};

    if (domains.includes('Regulon')) {
      if (wrapper.regulon.result != null) {
        const regulatorText = nullCoalesce(wrapper.regulon.result.regulator_family, '');
        const activatedText = wrapper.regulon.result.activated_by ? wrapper.regulon.result.activated_by.join('; ') : '';
        const repressedText = wrapper.regulon.result.repressed_by ? wrapper.regulon.result.repressed_by.join('; ') : '';

        results.Regulon = {
          'Regulator Family': {
            text: regulatorText,
            link: wrapper.regulon.link,
            annotatedText: regulatorText
          }, 'Activated By': {
            text: activatedText,
            link: wrapper.regulon.link,
            annotatedText: activatedText
          }, 'Repressed By': {
            text: repressedText,
            link: wrapper.regulon.link,
            annotatedText: repressedText
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
            annotatedText: wrapper.uniprot.result.function
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
            annotatedText: wrapper.string.result.annotation !== 'annotation not available' ?
              wrapper.string.result.annotation : '',
            link: wrapper.string.result.id ? wrapper.string.link + wrapper.string.result.id :
            wrapper.string.link + wrapper.biocyc.result.biocyc_id
          },
        };
      }
    }

    if (domains.includes('GO')) {
      if (wrapper.go.result != null) {
        const text = this.processGoWrapper(wrapper.go.result);
        results.GO = {
          Annotation: {
            text,
            annotatedText: text,
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
            annotatedText: wrapper.biocyc.result.pathways ? wrapper.biocyc.result.pathways.join('; ') : '',
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
  annotatedImported?: string;
  matched?: string;
  annotatedMatched?: string;
  fullName?: string;
  annotatedFullName?: string;
  link?: string;
  domains?: { [domain: string]: EnrichedGeneDomain };
}

export interface EnrichmentResult {
  version: '3';
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

export interface EnrichmentParsedData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  importGenes: string[];
  taxID: string;
  organism: string;
  domains: string[];
  result?: EnrichmentResult;
}
