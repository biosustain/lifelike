import { Observable, of } from 'rxjs';
import { mapBlobToBuffer, mapBufferToJson } from '../../shared/utils/files';
import { map, mergeMap } from 'rxjs/operators';
import {
  EnrichmentTableService,
  EnrichmentWrapper,
  NCBIWrapper,
} from '../services/enrichment-table.service';

export class EnrichmentDocument {
  taxID: string;
  organism: string;
  importGenes: string[];
  domains: string[];
  result: EnrichmentResult = {
    version: '1',
    ncbiNodes: [],
    domainResults: [],
  };
  duplicateGenes: string[];

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

    let columnOrder: string[];

    // parse for column order/domain input
    if (domains != null) {
      columnOrder = [...domains];
    } else {
      // Default view for existing tables
      domains = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
      columnOrder = ['Regulon', 'UniProt', 'String', 'GO', 'Biocyc'];
    }

    const [uniqueImportGenes, duplicateGenes] = this.removeDuplicates(rawImportGenes);

    // We set these all at the end to be thread/async-safe
    this.importGenes = uniqueImportGenes;
    this.taxID = taxID;
    this.organism = organism;
    this.domains = domains;
    this.duplicateGenes = duplicateGenes;
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

          return (data.result ? of(data.result) : this.generateEnrichmentResults(importGenes, taxID))
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
        this.importGenes.join(', '),
        this.taxID,
        this.organism,
        this.domains,
      ].join('/'),
      ...(this.result != null ? {
        result: this.result,
      } : {})
    };

    return of(new Blob([JSON.stringify(data)]));
  }

  refreshData(): Observable<this> {
    this.result = null;
    return this.generateEnrichmentResults(this.importGenes, this.taxID).pipe(
      map((result: EnrichmentResult) => {
        this.result = result;
        return this;
      }),
    );
  }

  private generateEnrichmentResults(importGenes: string[], taxID: string): Observable<EnrichmentResult> {
    return this.worksheetViewerService
      .matchNCBINodes(importGenes, taxID)
      .pipe(
        mergeMap((ncbiNodes: NCBIWrapper[]) => {
          const ncbiIds = ncbiNodes.map((wrapper) => wrapper.neo4jID);
          return this.worksheetViewerService
            .getNCBIEnrichmentDomains(ncbiIds, taxID)
            .pipe(
              map((domainResults: EnrichmentWrapper[]): EnrichmentResult => {
                return {
                  version: '1',
                  ncbiNodes,
                  domainResults,
                };
              }),
            );
        }),
      );
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
}

export interface EnrichmentResult {
  version: '1';
  ncbiNodes: NCBIWrapper[];
  domainResults: EnrichmentWrapper[];
}

export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
  result?: EnrichmentResult;
}
