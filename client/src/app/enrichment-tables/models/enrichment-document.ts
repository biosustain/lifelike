import { concat, merge, Observable, of } from 'rxjs';
import { mapBlobToBuffer, mapBufferToJson } from '../../shared/utils/files';
import { concatMap, first, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import {
  EnrichmentTableService,
  EnrichmentWrapper,
  GoNode,
  NCBINode,
  NCBIWrapper,
} from '../services/enrichment-table.service';
import { nullCoalesce } from '../../shared/utils/types';
import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';

enum Domain {
    Uniprot = 'UniProt',
    Regulon = 'Regulon',
    String = 'String',
    GO = 'GO',
    Biocyc = 'Biocyc'
}

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
  fileId = '';

  constructor(protected readonly worksheetViewerService: EnrichmentTableService) {}

  setParameters(fileId: string, importGenes: string[], taxID: string, organism: string, domains?: string[]) {
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
    this.fileId = fileId;
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

  load(blob: Blob, fileId: string): Observable<this> {
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
        mergeMap((data: EnrichmentData): Observable<this> => {
          // parse the file content to get gene list and organism tax id and name
          const resultArray = data.data.split('/');
          const importGenes = resultArray[0].split(',');
          const taxID = resultArray[1];
          const organism = resultArray[2];
          const domains = resultArray.length > 3 ? resultArray[3].split(',') : null;
          this.setParameters(fileId, importGenes, taxID, organism, domains);

          // We set these all at the end to be thread/async-safe
          return this.annotate();
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
    if (this.fileId === '') {
      // file was just created
      return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
        map((result: EnrichmentResult) => {
          this.result = result;
          return this;
        }),
      );
    } else {
      return this.annotate(true);
    }
  }

  private annotate(refresh = false): Observable<this> {
    // retrieve annotated enrichment snippets if they exist
    return this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
      mergeMap((enriched: EnrichmentResult) => {
        if (Object.keys(enriched).length > 0 && refresh === false) {
          this.result = enriched;
          return of(this);
        } else {
          return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID)
            .pipe(
            mergeMap((newResult: EnrichmentResult) => {
              const annotationRequests = [];
              if (refresh) {
                annotationRequests.push(
                  this.worksheetViewerService.refreshEnrichmentAnnotations([this.fileId], refresh));
              }
              let rowCounter = 0;
              const texts: EnrichmentTextMapping[] = [];
              for (const gene of newResult.genes) {
                // genes that did not match will not have domains
                if (gene.hasOwnProperty('domains')) {
                  texts.push({text: gene.imported, row: rowCounter, imported: true});
                  texts.push({text: gene.matched, row: rowCounter, matched: true});
                  texts.push({text: gene.fullName, row: rowCounter, fullName: true});
                  for (const [entryDomain, entryData] of Object.entries(gene.domains)) {
                    switch (entryDomain) {
                      case (Domain.Biocyc):
                        texts.push({
                          text: entryData.Pathways.text,
                          row: rowCounter,
                          domain: entryDomain,
                          label: 'Pathways'});
                        break;
                      case (Domain.GO):
                        texts.push({
                          text: entryData.Annotation.text,
                          row: rowCounter,
                          domain: entryDomain,
                          label: 'Annotation'});
                        break;
                      case (Domain.String):
                        texts.push({
                          text: entryData.Annotation.text,
                          row: rowCounter,
                          domain: entryDomain,
                          label: 'Annotation'});
                        break;
                      case (Domain.Uniprot):
                        texts.push({
                          text: entryData.Function.text,
                          row: rowCounter,
                          domain: entryDomain,
                          label: 'Function'});
                        break;
                    }
                  }
                  rowCounter += 1;
                }
              }

              annotationRequests.push(
                this.worksheetViewerService.annotateEnrichment(
                  [this.fileId],
                  {
                    texts,
                    organism: {
                      organism_name: this.organism,
                      synonym: this.organism,
                      tax_id: this.taxID
                    },
                    enrichment: newResult
                  } as TextAnnotationGenerationRequest
                )
              );

              const annotated$ = concat(annotationRequests).pipe(
                concatMap(res => merge(res)),
                toArray(),
              );
              return annotated$.pipe(
                first(),
                map(res => res),
                switchMap(_ => this.worksheetViewerService.getAnnotatedEnrichment(
                  this.fileId)),
                map(finalResult => {
                  this.result = finalResult;
                  return this;
                }),
              );
            }),
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
            annotatedText: nullCoalesce(wrapper.regulon.result.regulator_family, '')
          }, 'Activated By': {
            text: wrapper.regulon.result.activated_by ? wrapper.regulon.result.activated_by.join('; ') : '',
            link: wrapper.regulon.link,
            annotatedText: wrapper.regulon.result.activated_by ? wrapper.regulon.result.activated_by.join('; ') : ''
          }, 'Repressed By': {
            text: wrapper.regulon.result.repressed_by ? wrapper.regulon.result.repressed_by.join('; ') : '',
            link: wrapper.regulon.link,
            annotatedText: wrapper.regulon.result.repressed_by ? wrapper.regulon.result.repressed_by.join('; ') : ''
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
            annotatedText: this.processGoWrapper(wrapper.go.result),
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
        .map((node) => node.name)
        .slice(0, 5)
        .join('; ');
    }
  }
}

export interface EnrichmentTextMapping {
    text: string;
    row: number;
    domain?: string;
    // this is the Biocyc: Pathways
    // UniProt: Function
    // etc
    label?: string;
    matched?: boolean;
    imported?: boolean;
    fullName?: boolean;
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
