import { uniqueId } from 'lodash';
import { Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { combineLatest, Subject, Subscription, BehaviorSubject, Observable } from 'rxjs';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { Hyperlink, DatabaseType, AnnotationType } from 'app/shared/constants';

import { PdfAnnotationsService } from '../../drawing-tool/services';

import { cloneDeep } from 'lodash';
import {
  AddedAnnotationExclsuion,
  Annotation,
  Location,
  Meta,
  RemovedAnnotationExclusion,
  UniversalGraphNode,
} from '../../drawing-tool/services/interfaces';

import { MatSnackBar } from '@angular/material/snack-bar';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { PdfViewerLibComponent } from '../../pdf-viewer/pdf-viewer-lib.component';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ActivatedRoute } from '@angular/router';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { ConfirmDialogComponent } from '../../shared/components/dialog/confirm-dialog.component';
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { FileEditDialogComponent } from './file-edit-dialog.component';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { Pane, WorkspaceManager } from '../../shared/workspace-manager';

class DummyFile implements PdfFile {
  constructor(
    // tslint:disable-next-line
    public file_id: string,
    public filename: string = null,
    // tslint:disable-next-line
    public creation_date: string = null,
    public username: string = null) {
  }
}

class EntityTypeEntry {
  constructor(public type: EntityType, public annotations: Annotation[]) {
  }
}

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './file-view.component.html',
  styleUrls: ['./file-view.component.scss'],
})

export class FileViewComponent implements OnDestroy, ModuleAwareComponent {
  @ViewChild('dropdown', {static: false, read: NgbDropdown}) dropdownComponent: NgbDropdown;
  @Output() requestClose: EventEmitter<any> = new EventEmitter();
  @Output() fileOpen: EventEmitter<PdfFile> = new EventEmitter();

  id = uniqueId('FileViewComponent-');

  paramsSubscription: Subscription;
  returnUrl: string;

  annotations: Annotation[] = [];
  // We don't want to modify the above array when we add annotations, because
  // data flow right now is very messy
  addedCustomAnnotations: Annotation[] = [];
  /**
   * A mapping of annotation type (i.e. Genes) to a list of those annotations.
   */
  annotationEntityTypeMap: Map<string, Annotation[]> = new Map();
  entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Output() filterChangeSubject = new Subject<void>();

  searchChanged: Subject<{ keyword: string, findPrevious: boolean }> = new Subject<{ keyword: string, findPrevious: boolean }>();
  searchQuery = '';
  goToPosition: Subject<Location> = new Subject<Location>();
  loadTask: BackgroundTask<[PdfFile, Location], [PdfFile, ArrayBuffer, any]>;
  pendingScroll: Location;
  openPdfSub: Subscription;
  ready = false;
  pdfFile: PdfFile;
  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  pdfData: { url?: string, data?: Uint8Array };
  currentFileId: string;
  addedAnnotations: Annotation[];
  addAnnotationSub: Subscription;
  removedAnnotationIds: string[];
  removeAnnotationSub: Subscription;
  pdfFileLoaded = false;
  sortedEntityTypeEntries: EntityTypeEntry[] = [];
  entityTypeVisibilityChanged = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  addedAnnotationExclusion: AddedAnnotationExclsuion;
  addAnnotationExclusionSub: Subscription;
  showExcludedAnnotations = false;
  removeAnnotationExclusionSub: Subscription;
  removedAnnotationExclusion: RemovedAnnotationExclusion;
  projectName: string;

  @ViewChild(PdfViewerLibComponent, {static: false}) pdfViewerLib;
  @ViewChild('search', {static: false}) searchElement: ElementRef;

  constructor(
    private readonly filesService: PdfFilesService,
    private pdfAnnService: PdfAnnotationsService,
    private pdf: PdfFilesService,
    private snackBar: MatSnackBar,
    private readonly modalService: NgbModal,
    private route: ActivatedRoute,
    private readonly errorHandler: ErrorHandler,
    private readonly progressDialog: ProgressDialog,
    private readonly workSpaceManager: WorkspaceManager
  ) {
    this.projectName = this.route.snapshot.params.project_name || '';

    this.loadTask = new BackgroundTask(([file, loc]) => {
      return combineLatest(
        this.pdf.getFileMeta(file.file_id, this.projectName),
        this.pdf.getFile(file.file_id, this.projectName),
        this.pdfAnnService.getFileAnnotations(file.file_id, this.projectName));
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openPdfSub = this.loadTask.results$.subscribe(({
                                                          result: [pdfFile, pdfFileContent, ann],
                                                          value: [file, loc],
                                                        }) => {
      this.pdfData = {data: new Uint8Array(pdfFileContent)};
      this.annotations = ann;
      this.updateAnnotationIndex();
      this.updateSortedEntityTypeEntries();
      this.pdfFile = pdfFile;
      this.emitModuleProperties();

      this.currentFileId = file.file_id;
      setTimeout(() => {
        this.ready = true;
      }, 10);
    });

    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      const linkedFileId = this.route.snapshot.params.file_id;
      const fragment = this.route.snapshot.fragment || '';
      // TODO: Do proper query string parsing
      this.openPdf(new DummyFile(linkedFileId), this.parseLocationFromUrl(fragment));
    }
  }

  updateAnnotationIndex() {
    // Create index of annotation types
    this.annotationEntityTypeMap.clear();
    for (const annotation of [...this.annotations, ...this.addedCustomAnnotations]) {
      const entityType: EntityType = ENTITY_TYPE_MAP[annotation.meta.type];
      if (!entityType) {
        throw new Error(`unknown entity type ${annotation.meta.type} not in ENTITY_TYPE_MAP`);
      }
      let typeAnnotations = this.annotationEntityTypeMap.get(entityType.id);
      if (!typeAnnotations) {
        typeAnnotations = [];
        this.annotationEntityTypeMap.set(entityType.id, typeAnnotations);
      }
      typeAnnotations.push(annotation);
    }
  }

  updateSortedEntityTypeEntries() {
    this.sortedEntityTypeEntries = ENTITY_TYPES
      .map(entityType => new EntityTypeEntry(entityType, this.annotationEntityTypeMap.get(entityType.id) || []))
      .sort((a, b) => {
        if (a.annotations.length && !b.annotations.length) {
          return -1;
        } else if (!a.annotations.length && b.annotations.length) {
          return 1;
        } else {
          return a.type.name.localeCompare(b.type.name);
        }
      });
  }

  isEntityTypeVisible(entityType: EntityType) {
    const value = this.entityTypeVisibilityMap.get(entityType.id);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  setAllEntityTypesVisibility(state: boolean) {
    for (const type of ENTITY_TYPES) {
      this.entityTypeVisibilityMap.set(type.id, state);
    }
    this.invalidateEntityTypeVisibility();
  }

  changeEntityTypeVisibility(entityType: EntityType, event) {
    this.entityTypeVisibilityMap.set(entityType.id, event.target.checked);
    this.invalidateEntityTypeVisibility();
  }

  invalidateEntityTypeVisibility() {
    // Keep track if the user has some entity types disabled
    let entityTypeVisibilityChanged = false;
    for (const value of this.entityTypeVisibilityMap.values()) {
      if (!value) {
        entityTypeVisibilityChanged = true;
        break;
      }
    }
    this.entityTypeVisibilityChanged = entityTypeVisibilityChanged;

    this.filterChangeSubject.next();
  }

  closeFilterPopup() {
    this.dropdownComponent.close();
  }

  annotationCreated(annotation: Annotation) {
    // try getting id from the ncbi or uniprot link
    let id = '';
    let idType = '';

    const uniprotRegExp = new RegExp('uniprot\.org\.uniprot\/([^?#]*)');
    const uniprotResult = uniprotRegExp.exec(annotation.meta.links.uniprot);
    if (uniprotResult && uniprotResult[1]) {
      id = uniprotResult[1];
      idType = 'UNIPROT';
    }

    const ncbiRegExp = new RegExp('ncbi\.nlm\.nih\.gov\/gene\/([^?#]*)');
    const ncbiResult = ncbiRegExp.exec(annotation.meta.links.ncbi);
    if (ncbiResult && ncbiResult[1]) {
      id = ncbiResult[1];
      idType = 'NCBI';
    }

    const annotationToAdd: Annotation = {
      ...annotation,
      meta: {
        ...annotation.meta,
        id: annotation.meta.id || id,
        idType,
      },
    };

    annotationToAdd.meta.idHyperlink = this.generateHyperlink(annotationToAdd);

    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message = 'Do you want to annotate the rest of the document with this term as well?';
    dialogRef.result.then((annotateAll: boolean) => {
      const progressDialogRef = this.progressDialog.display({
        title: `Adding Annotations`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Adding annotations to the file...',
        })),
      });

      this.addAnnotationSub = this.pdfAnnService.addCustomAnnotation(this.currentFileId, annotationToAdd, annotateAll, this.projectName)
        .pipe(this.errorHandler.create())
        .subscribe(
          (annotations: Annotation[]) => {
            progressDialogRef.close();
            this.addedAnnotations = annotations;
            this.snackBar.open('Annotation has been added', 'Close', {duration: 5000});
          },
          err => {
            progressDialogRef.close();
          },
        );
    }, () => {
    });

    this.addedCustomAnnotations.push(annotation);
    this.updateAnnotationIndex();
    this.updateSortedEntityTypeEntries();
  }

  annotationRemoved(uuid) {
    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message = 'Do you want to remove all matching annotations from the file as well?';
    dialogRef.result.then((removeAll: boolean) => {
      this.removeAnnotationSub = this.pdfAnnService.removeCustomAnnotation(this.currentFileId, uuid, removeAll, this.projectName)
        .pipe(this.errorHandler.create())
        .subscribe(
          response => {
            this.removedAnnotationIds = response;
            this.snackBar.open('Removal completed', 'Close', {duration: 10000});
          },
          err => {
            this.snackBar.open(`Error: removal failed`, 'Close', {duration: 10000});
          },
        );
    }, () => {
    });
  }

  annotationExclusionAdded(exclusionData: AddedAnnotationExclsuion) {
    this.addAnnotationExclusionSub = this.pdfAnnService.addAnnotationExclusion(
      this.currentFileId, exclusionData, this.projectName,
    )
      .pipe(this.errorHandler.create())
      .subscribe(
        response => {
          this.addedAnnotationExclusion = exclusionData;
          this.snackBar.open('Annotation has been excluded', 'Close', {duration: 5000});
        },
        err => {
          this.snackBar.open(`Error: failed to exclude annotation`, 'Close', {duration: 10000});
        },
      );
  }

  annotationExclusionRemoved({type, text}) {
    this.removeAnnotationExclusionSub = this.pdfAnnService.removeAnnotationExclusion(this.currentFileId, type, text, this.projectName)
      .pipe(this.errorHandler.create())
      .subscribe(
        response => {
          this.removedAnnotationExclusion = {type, text};
          this.snackBar.open('Unmarked successfully', 'Close', {duration: 5000});
        },
        err => {
          const {message, name} = err.error.apiHttpError;
          this.snackBar.open(`${name}: ${message}`, 'Close', {duration: 10000});
        },
      );
  }

  /**
   * Handle drop event from draggable annotations
   * of the pdf-viewer
   * @param event represents a drop event
   */
  addAnnotationDragData(event: DragEvent) {
    const nodeDom = event.target as HTMLElement;

    // everything that graphbuilder might need is under meta
    const meta: Meta = JSON.parse(nodeDom.getAttribute('meta')) as Meta;

    // use location object to scroll in the pdf.
    const loc: Location = JSON.parse(nodeDom.getAttribute('location')) as Location;

    const source = `/projects/${encodeURIComponent(this.projectName)}`
      + `/files/${encodeURIComponent(this.currentFileId)}`
      + `#page=${loc.pageNumber}&coords=${loc.rect[0]},${loc.rect[1]},${loc.rect[2]},${loc.rect[3]}`;

    const sources = [{
      domain: 'File Source',
      url: source
    }];

    if (this.pdfFile.doi) {
      sources.push({
        domain: 'DOI',
        url: this.pdfFile.doi
      });
    }

    if (this.pdfFile.upload_url) {
      sources.push({
        domain: 'Upload URL',
        url: this.pdfFile.upload_url
      });
    }

    const hyperlink = meta.idHyperlink || meta.primaryLink || '';

    const search = Object.keys(meta.links || []).map(k => {
      return {
        domain: k,
        url: meta.links[k],
      };
    });

    const text = meta.type === 'link' ? 'Link' : meta.allText;

    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', text);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: text,
      label: meta.type.toLowerCase(),
      sub_labels: [],
      data: {
        sources,
        search,
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.pdfFile.file_id,
        }, {
          type: 'DATABASE',
          url: hyperlink,
        }],
        hyperlinks: [{
          domain: 'Annotation URL',
          url: hyperlink,
        }],
        detail: meta.type === 'link' ? meta.allText : '',
      },
      style: {
        showDetail: meta.type === 'link',
      }
    } as Partial<UniversalGraphNode>));
  }

  zoomIn() {
    this.pdfViewerLib.incrementZoom(0.1);
  }

  zoomOut() {
    this.pdfViewerLib.incrementZoom(-0.1);
  }

  zoomActualSize() {
    this.pdfViewerLib.setZoom(1);
    this.pdfViewerLib.originalSize = true;
  }

  fitToPage() {
    this.pdfViewerLib.setZoom(1);
    this.pdfViewerLib.originalSize = false;
  }

  /**
   * Open pdf by file_id along with location to scroll to
   * @param file - represent the pdf to open
   * @param loc - the location of the annotation we want to scroll to
   */
  openPdf(file: PdfFile, loc: Location = null) {
    if (this.currentFileId === file.file_id) {
      if (loc) {
        this.scrollInPdf(loc);
      }
      return;
    }
    this.pendingScroll = loc;
    this.pdfFileLoaded = false;
    this.ready = false;

    this.loadTask.update([file, loc]);
  }

  ngOnDestroy() {
    if (this.paramsSubscription) {
      this.paramsSubscription.unsubscribe();
    }
    if (this.openPdfSub) {
      this.openPdfSub.unsubscribe();
    }
    if (this.addAnnotationSub) {
      this.addAnnotationSub.unsubscribe();
    }
    if (this.removeAnnotationSub) {
      this.removeAnnotationSub.unsubscribe();
    }
    if (this.addAnnotationExclusionSub) {
      this.addAnnotationExclusionSub.unsubscribe();
    }
    if (this.removeAnnotationExclusionSub) {
      this.removeAnnotationExclusionSub.unsubscribe();
    }
  }

  generateHyperlink(ann: Annotation): string {
    switch (ann.meta.idType) {
      case DatabaseType.Chebi:
        return this.buildUrl(Hyperlink.Chebi, ann.meta.id);
      case DatabaseType.Mesh:
        // prefix 'MESH:' should be removed from the id in order for search to work
        return this.buildUrl(Hyperlink.Mesh, ann.meta.id.substring(5));
      case DatabaseType.Uniprot:
        return this.buildUrl(Hyperlink.Uniprot, ann.meta.id);
      case DatabaseType.Ncbi:
        if (ann.meta.type === AnnotationType.Gene) {
          return this.buildUrl(Hyperlink.NcbiGenes, ann.meta.id);
        } else if (ann.meta.type === AnnotationType.Species) {
          return this.buildUrl(Hyperlink.NcbiSpecies, ann.meta.id);
        }
        return '';
      default:
        return '';
    }
  }

  private buildUrl(provider: Hyperlink, query: string): string {
    return provider + query;
  }

  scrollInPdf(loc: Location) {
    if (!this.pdfFileLoaded) {
      console.log('File in the pdf viewer is not loaded yet. So, I cant scroll');
      this.pendingScroll = loc;
      return;
    }
    this.goToPosition.next(loc);
  }

  loadCompleted(status) {
    this.pdfFileLoaded = status;
    if (this.pdfFileLoaded && this.pendingScroll) {
      this.scrollInPdf(this.pendingScroll);
      this.pendingScroll = null;
    }
  }

  close() {
    this.requestClose.emit(null);
  }

  searchQueryChanged() {
    if (this.searchQuery === '') {
      this.pdfViewerLib.nullifyMatchesCount();
    }
    this.searchChanged.next({
      keyword: this.searchQuery,
      findPrevious: false,
    });
  }

  findNext() {
    this.searchQueryChanged();
  }

  findPrevious() {
    this.searchChanged.next({
      keyword: this.searchQuery,
      findPrevious: true,
    });
  }

  clearSearchQuery() {
    this.searchQuery = '';
    this.searchQueryChanged();
    this.searchElement.nativeElement.focus();
  }

  displayEditDialog() {
    const dialogRef = this.modalService.open(FileEditDialogComponent);
    dialogRef.componentInstance.file = cloneDeep(this.pdfFile);
    dialogRef.result.then(newFile => {
      if (newFile) {
        this.filesService.updateFileMeta(
          this.projectName,
          this.pdfFile.file_id,
          newFile.filename,
          newFile.description,
        )
          .pipe(this.errorHandler.create())
          .subscribe(() => {
            this.pdfFile.filename = newFile.filename;
            this.pdfFile.description = newFile.description;
            this.emitModuleProperties();
            this.snackBar.open(`File details updated`, 'Close', {duration: 5000});
          });
      }
    }, () => {
    });
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.pdfFile.filename,
      fontAwesomeIcon: 'file-pdf',
    });
  }

  parseLocationFromUrl(fragment: string): Location | undefined {
    const pageMatch = fragment.match(/page=([0-9]+)/);
    const coordMatch = fragment.match(/coords=([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);
    return pageMatch != null && coordMatch != null ? {
      pageNumber: parseInt(pageMatch[1], 10),
      rect: [
        parseFloat(coordMatch[1]),
        parseFloat(coordMatch[2]),
        parseFloat(coordMatch[3]),
        parseFloat(coordMatch[4]),
      ],
    } : null;
  }

  displayShareDialog() {
    const modalRef = this.modalService.open(ShareDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/projects/`
      + `${this.projectName}/files/${this.currentFileId}?fromWorkspace`;
  }

  openWordCloudPane() {
    const url = `/word-cloud/${this.projectName}/${this.pdfFile.file_id}`;
    this.workSpaceManager.navigateByUrl(url, {sideBySide: true, newTab: true});
  }
}
