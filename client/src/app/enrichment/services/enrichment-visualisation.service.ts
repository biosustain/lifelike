import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatSnackBar } from "@angular/material/snack-bar";

import { combineLatest, Observable } from "rxjs";
import { map, mergeMap } from "rxjs/operators";

import { BackgroundTask, TaskResult } from "app/shared/rxjs/background-task";
import { ErrorHandler } from "app/shared/services/error-handler.service";
import { FilesystemObject } from "app/file-browser/models/filesystem-object";

import { BaseEnrichmentDocument, EnrichmentParsedData } from "../models/enrichment-document";
import { EnrichmentService } from "./enrichment.service";

export interface EnrichWithGOTermsResult {
  "p-value": any;
  goLabel: string[];
  geneNames: string[];
  gene: string;
}

const MIN_REPRESENTED_NUMBER = 0.0000000001;
const addressPrecisionMistake = (d) => {
  d["q-value"] = d["q-value"] || MIN_REPRESENTED_NUMBER;
  d["p-value"] = d["p-value"] || MIN_REPRESENTED_NUMBER;
  return d;
};

@Injectable()
export class EnrichmentVisualisationService {
  object: FilesystemObject;
  loadTask: BackgroundTask<null, EnrichmentParsedData>;
  loadTaskMetaData: BackgroundTask<null, FilesystemObject>;
  load: Observable<[TaskResult<null, FilesystemObject>, TaskResult<null, EnrichmentParsedData>]>;
  loaded = false;
  enrichmentDocument: BaseEnrichmentDocument;
  private currentFileId: string;

  get fileId(): string {
    return this.currentFileId;
  }

  set fileId(fileId: string) {
    const enrichmentDocument = (this.enrichmentDocument = new BaseEnrichmentDocument());
    this.currentFileId = fileId;
    this.loadTaskMetaData = new BackgroundTask(() =>
      this.enrichmentService.get(this.fileId).pipe(
        this.errorHandler.create({ label: "Load Statistical Enrichment" }),
        map((value: FilesystemObject, _) => (this.object = value))
      )
    );
    this.loadTask = new BackgroundTask(() =>
      this.enrichmentService.getContent(this.fileId).pipe(
        this.errorHandler.create({ label: "Load Statistical Enrichment" }),
        mergeMap((blob: Blob) => enrichmentDocument.load(blob))
      )
    );

    this.load = combineLatest(this.loadTaskMetaData.results$, this.loadTask.results$);

    this.loadTaskMetaData.update();
    this.loadTask.update();
  }

  constructor(
    protected readonly http: HttpClient,
    protected readonly errorHandler: ErrorHandler,
    protected readonly snackBar: MatSnackBar,
    protected readonly enrichmentService: EnrichmentService
  ) {}

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param analysis - analysis ID to be used
   */
  enrichWithGOTerms(analysis = "fisher"): Observable<EnrichWithGOTermsResult[]> {
    const {
      result: { genes },
      taxID,
      organism,
    } = this.enrichmentDocument;
    const geneNames = genes.reduce((o, { matched }) => {
      if (matched) {
        o.push(matched);
      }
      return o;
    }, []);
    return this.http
      .post<{ result: [] }>(`/api/enrichment-visualisation/enrich-with-go-terms`, {
        geneNames,
        organism: `${taxID}/${organism}`,
        analysis,
      })
      .pipe(map((data: any) => data.map(addressPrecisionMistake)));
  }
}
