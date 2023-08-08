import { Observable, of, Subject } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';
import {
  compact as _compact,
  has as _has,
  isEmpty as _isEmpty,
  omitBy as _omitBy,
  pick as _pick,
} from 'lodash/fp';

import { mapBlobToBuffer } from 'app/shared/utils/files';
import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';

import {
  DomainWrapper,
  EnrichmentTableService,
  EnrichmentWrapper,
  NCBINode,
  NCBIWrapper,
} from '../services/enrichment-table.service';
import { environment } from '../../../environments/environment';

export class BaseEnrichmentDocument {
  taxID = '';
  organism = '';
  values = new Map<string, string>();
  importGenes: string[] = [];
  domains: string[] = _compact([
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'BioCyc',
    environment.keggEnabled && 'KEGG',
  ]);
  result: EnrichmentResult = null;
  duplicateGenes: string[] = [];
  fileId = '';
  markForRegeneration = false;
  changed$ = new Subject<void>();

  private parseParameters(params: EnrichmentParsedData): Partial<EnrichmentParsedData> {
    // parse the file content to get gene list and organism tax id and name
    const parsedParams = {} as EnrichmentParsedData;
    if (_has('importGenes', params)) {
      const { importGenes } = params;
      const rawImportGenes = importGenes.map((gene) => gene.trim()).filter((gene) => gene !== '');
      const duplicateGenes = this.getDuplicates(rawImportGenes);
      parsedParams.importGenes = rawImportGenes;
      parsedParams.duplicateGenes = duplicateGenes;
    }
    if (_has('taxID', params)) {
      const { taxID } = params;
      if (taxID === '562' || taxID === '83333') {
        parsedParams.taxID = '511145';
      } else if (taxID === '4932') {
        parsedParams.taxID = '559292';
      }
    }
    if (_has('domains', params)) {
      const { domains } = params;
      // parse for column order/domain input
      if (domains == null) {
        parsedParams.domains = this.domains;
      }
    }

    // We set these all at the end to be thread/async-safe
    return _omitBy((value, key) => this[key] === value)({
      ...params,
      ...parsedParams,
    });
  }

  setParameters(params) {
    // We set these all at the end to be thread/async-safe
    const parsedParams = this.parseParameters(params);
    if (!_isEmpty(_pick(['importGenes', 'taxID', 'domains'], parsedParams))) {
      this.markForRegeneration = true;
    }
    Object.assign(this, parsedParams);
    if (!_isEmpty(parsedParams)) {
      this.changed$.next();
    }
    return parsedParams;
  }

  /**
   * Remove any duplicates from the import gene list and populate duplicate list
   * @param arr string of gene names
   */
  private getDuplicates(arr: string[]): string[] {
    const duplicateArray = new Set<string>();
    const uniqueArray = new Set<string>();
    for (const item of arr) {
      if (uniqueArray.has(item)) {
        duplicateArray.add(item);
      } else {
        uniqueArray.add(item);
      }
    }
    return Array.from(duplicateArray);
  }

  load(blob: Blob): Observable<EnrichmentParsedData> {
    return of(blob).pipe(
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
          const split = s.split('/');
          return {
            data: {
              genes: split[0],
              taxId: split[1],
              organism: split[2],
              sources: split[3].split(','),
            },
          };
        }
      }),
      map((data) => this.decode(data)),
      tap((params) => this.setParameters(params)),
      tap(() => (this.markForRegeneration = false))
    );
  }

  encode({ importGenes, taxID, organism, domains, result }): EnrichmentData {
    return {
      data: {
        genes: importGenes.join(','),
        taxId: taxID,
        organism,
        sources: domains,
      },
      result,
    };
  }

  decode({ data, result, ...rest }: EnrichmentData): EnrichmentParsedData {
    // parse the file content to get gene list and organism tax id and name
    const importGenes = data.genes.split(',');
    const taxID = data.taxId;
    const organism = data.organism;
    const domains = data.sources.filter(
      (domain) => domain.length && (domain !== 'KEGG' || environment.keggEnabled)
    );
    const values = new Map<string, string>(
      result.genes.map((gene) => [gene.imported, gene.value || ''])
    );
    return {
      importGenes,
      taxID,
      organism,
      domains,
      values,
      result,
      ...rest,
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
    return super.load(blob).pipe(
      mergeMap(() => this.annotate()),
      map(() => this)
    );
  }

  refreshData(): Observable<this> {
    if (!this.fileId) {
      this.result = null;
      this.changed$.next();
      // file was just created
      return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
        map((result: EnrichmentResult) => {
          this.result = result;
          this.changed$.next();
          return this;
        })
      );
    } else {
      if (!this.markForRegeneration) {
        return of(null);
      }
      this.result = null;
      this.changed$.next();
      return this.worksheetViewerService
        .refreshEnrichmentAnnotations([this.fileId])
        .pipe(mergeMap((_) => this.annotate()));
    }
  }

  updateParameters(): Observable<Blob> {
    if (!this.markForRegeneration) {
      return of(new Blob([JSON.stringify(this.encode(this))]));
    }
    return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
      mergeMap((result: EnrichmentResult) => {
        const importGenes = this.importGenes;
        const taxID = this.taxID;
        const organism = this.organism;
        const domains = this.domains;
        const data: EnrichmentData = this.encode({ importGenes, taxID, organism, domains, result });
        return of(new Blob([JSON.stringify(data)]));
      })
    );
  }

  private annotate(): Observable<this> {
    // retrieve annotated enrichment snippets if they exist
    return this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
      mergeMap((enriched: EnrichmentParsedData) => {
        if (Object.keys(enriched).length > 0) {
          this.result = enriched.result;
          this.changed$.next();
          return of(this);
        } else {
          this.result = enriched.result;
          return of(this);
          // TODO: There is a problem here. Because we are performing the annotations
          // asynchronously, this can fire off potentially many times before annotations are
          // generated. Going to disable this for now, in favor of the explicit methods of
          // annotation. Those being: 1) Uploading a file 2) Manually choosing
          // re-annotation from the file toolbar.
          // const params = {
          //   organism: {
          //     organism_name: this.organism,
          //     synonym: this.organism,
          //     tax_id: this.taxID
          //   },
          // } as TextAnnotationGenerationRequest;
          // return this.worksheetViewerService.annotateEnrichment([this.fileId], params).pipe(
          //   mergeMap(() => this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
          //     map((annotated: EnrichmentParsedData) => {
          //       this.result = annotated.result;
          //       return this;
          //     })
          //   ))
          // );
        }
      })
    );
  }

  private generateEnrichmentResults(
    domains: string[],
    importGenes: string[],
    taxID: string
  ): Observable<EnrichmentResult> {
    return this.worksheetViewerService.matchNCBINodes(importGenes, taxID).pipe(
      mergeMap((ncbiNodesData: NCBIWrapper[]) => {
        const arangoIds = ncbiNodesData.map((wrapper) => wrapper.geneArangoId);
        return this.worksheetViewerService.getNCBIEnrichmentDomains(arangoIds, taxID, domains).pipe(
          map((domainResults: EnrichmentWrapper): EnrichmentResult => {
            // a gene can point to 2 different synonyms
            // and a synonym can point to 2 different genes
            const arangoIdSynonymMap: Map<string, Map<string, string>> = new Map();
            const arangoIdNodeMap: Map<string, Map<string, NCBINode>> = new Map();
            const arangoIdLinkMap: Map<string, Map<string, string>> = new Map();
            const geneSynonymArangoIdMap: Map<string, Map<string, string>> = new Map();
            const geneMap: Set<string> = new Set();
            const genesList: EnrichedGene[] = [];
            const synonymsSet: Set<string> = new Set();
            // list of tuples
            const synonymArangoIds: [string, string][] = [];

            ncbiNodesData.forEach((wrapper) => {
              geneSynonymArangoIdMap.has(wrapper.synonymArangoId)
                ? geneSynonymArangoIdMap
                    .get(wrapper.synonymArangoId)
                    .set(wrapper.geneArangoId, wrapper.geneArangoId)
                : geneSynonymArangoIdMap.set(
                    wrapper.synonymArangoId,
                    new Map().set(wrapper.geneArangoId, wrapper.geneArangoId)
                  );

              arangoIdSynonymMap.has(wrapper.synonymArangoId)
                ? arangoIdSynonymMap
                    .get(wrapper.synonymArangoId)
                    .set(wrapper.geneArangoId, wrapper.synonym)
                : arangoIdSynonymMap.set(
                    wrapper.synonymArangoId,
                    new Map().set(wrapper.geneArangoId, wrapper.synonym)
                  );

              arangoIdNodeMap.has(wrapper.synonymArangoId)
                ? arangoIdNodeMap
                    .get(wrapper.synonymArangoId)
                    .set(wrapper.geneArangoId, wrapper.gene)
                : arangoIdNodeMap.set(
                    wrapper.synonymArangoId,
                    new Map().set(wrapper.geneArangoId, wrapper.gene)
                  );

              arangoIdLinkMap.has(wrapper.synonymArangoId)
                ? arangoIdLinkMap
                    .get(wrapper.synonymArangoId)
                    .set(wrapper.geneArangoId, wrapper.link)
                : arangoIdLinkMap.set(
                    wrapper.synonymArangoId,
                    new Map().set(wrapper.geneArangoId, wrapper.link)
                  );

              synonymsSet.add(wrapper.synonym);
              synonymArangoIds.push([wrapper.synonymArangoId, wrapper.geneArangoId]);
            });

            for (const [synId, geneId] of synonymArangoIds) {
              const synonym = arangoIdSynonymMap.get(synId).get(geneId);
              const node = arangoIdNodeMap.get(synId).get(geneId);
              const link = arangoIdLinkMap.get(synId).get(geneId);
              const domainWrapper =
                domainResults[geneSynonymArangoIdMap.get(synId).get(geneId)] || null;

              if (domainWrapper !== null) {
                geneMap.add(synonym);
                genesList.push({
                  imported: synonym,
                  annotatedImported: synonym,
                  matched: node.name,
                  annotatedMatched: node.name,
                  fullName: node.full_name || '',
                  annotatedFullName: node.full_name || '',
                  link,
                  domains: this.generateGeneDomainResults(domains, domainWrapper, node),
                  value: this.values.get(synonym) || '',
                });
              }
            }

            for (const gene of importGenes) {
              // Don't add the unmatched gene if we've already seen it.
              if (!synonymsSet.has(gene) && !geneMap.has(gene)) {
                geneMap.add(gene);
                genesList.push({
                  imported: gene,
                  value: this.values.get(gene) || '',
                });
              }
            }

            return {
              domainInfo: _omitBy(_isEmpty)({
                Regulon: {
                  labels: ['Regulator Family', 'Activated By', 'Repressed By'],
                },
                UniProt: { labels: ['Function'] },
                String: { labels: ['Annotation'] },
                GO: { labels: ['Annotation'] },
                BioCyc: { labels: ['Pathways'] },
                KEGG: environment.keggEnabled && { labels: ['Pathways'] },
              }),
              genes: genesList,
            };
          })
        );
      })
    );
  }

  /**
   * Process wrapper to convert domain data into string array that represents domain columns.
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param domains requested domains
   * @param wrapper data returned from get domains request
   * @param ncbiNode matched ncbi data
   * @returns table entries
   */
  private generateGeneDomainResults(
    domains: string[],
    wrapper: DomainWrapper,
    ncbiNode: NCBINode
  ): { [domain: string]: EnrichedGeneDomain } {
    const results: { [domain: string]: EnrichedGeneDomain } = {};

    if (domains.includes('Regulon')) {
      if (wrapper.regulon !== null) {
        const regulatorText = wrapper.regulon.result.regulator_family ?? '';
        const activatedText = wrapper.regulon.result.activated_by
          ? wrapper.regulon.result.activated_by.join('; ')
          : '';
        const repressedText = wrapper.regulon.result.repressed_by
          ? wrapper.regulon.result.repressed_by.join('; ')
          : '';

        results.Regulon = {
          'Regulator Family': {
            text: regulatorText,
            link: wrapper.regulon.link,
            annotatedText: regulatorText,
          },
          'Activated By': {
            text: activatedText,
            link: wrapper.regulon.link,
            annotatedText: activatedText,
          },
          'Repressed By': {
            text: repressedText,
            link: wrapper.regulon.link,
            annotatedText: repressedText,
          },
        };
      }
    }

    if (domains.includes('UniProt')) {
      if (wrapper.uniprot !== null) {
        results.UniProt = {
          Function: {
            text: wrapper.uniprot.result.function,
            link: wrapper.uniprot.link,
            annotatedText: wrapper.uniprot.result.function,
          },
        };
      }
    }

    if (domains.includes('String')) {
      if (wrapper.string !== null) {
        results.String = {
          Annotation: {
            text:
              wrapper.string.result.annotation !== 'annotation not available'
                ? wrapper.string.result.annotation
                : '',
            annotatedText:
              wrapper.string.result.annotation !== 'annotation not available'
                ? wrapper.string.result.annotation
                : '',
            link: wrapper.string.link,
          },
        };
      }
    }

    if (domains.includes('GO')) {
      if (wrapper.go !== null) {
        const text = this.shortenTerms(wrapper.go.result);
        results.GO = {
          Annotation: {
            text,
            annotatedText: text,
            link: wrapper.uniprot
              ? wrapper.go.link + wrapper.uniprot.result.id
              : 'http://amigo.geneontology.org/amigo/search/annotation?q=' +
                encodeURIComponent(ncbiNode.name),
          },
        };
      }
    }

    if (domains.includes('BioCyc')) {
      if (wrapper.biocyc !== null) {
        const text = wrapper.biocyc.result?.join('; ') ?? '';
        results.BioCyc = {
          Pathways: {
            text,
            annotatedText: text,
            link: wrapper.biocyc.link,
          },
        };
      }
    }

    if (environment.keggEnabled && domains.includes('KEGG')) {
      if (wrapper.kegg !== null) {
        const text = this.shortenTerms(wrapper.kegg.result);
        results.KEGG = {
          Pathways: {
            text,
            annotatedText: text,
            link: wrapper.kegg.link,
          },
        };
      }
    }

    return results;
  }

  private shortenTerms(terms: string[]): string {
    return (
      terms
        .map((name) => name)
        .slice(0, 5)
        .join('; ') + (terms.length > 5 ? '...' : '')
    );
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
  value?: string;
}

export interface EnrichmentResult {
  domainInfo: DomainInfoMap;
  genes: EnrichedGene[];
}

export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: {
    genes: string;
    taxId: string;
    organism: string;
    sources: string[];
  };
  result?: EnrichmentResult;
}

export interface EnrichmentParsedData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  importGenes: string[];
  duplicateGenes?: string[];
  taxID: string;
  organism: string;
  domains: string[];
  values?: Map<string, string>;
  result?: EnrichmentResult;
}
