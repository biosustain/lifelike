import { uniqueId } from 'lodash';
import { Component, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, of, Subject, Subscription } from 'rxjs';

import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import {
  AddedAnnotationExclusion,
  Annotation,
  Location,
  Meta,
  RemovedAnnotationExclusion,
} from '../annotation-type';

import { MatSnackBar } from '@angular/material/snack-bar';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { PdfViewerLibComponent } from '../pdf-viewer-lib.component';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ActivatedRoute } from '@angular/router';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { ConfirmDialogComponent } from '../../shared/components/dialog/confirm-dialog.component';
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mergeMap } from 'rxjs/operators';
import { readBlobAsBuffer } from '../../shared/utils/files';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { AnnotationsService } from '../../file-browser/services/annotations.service';

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
  highlightAnnotations: Subject<string> = new Subject<string>();
  loadTask: BackgroundTask<[string, Location], [[FilesystemObject, ArrayBuffer], Annotation[]]>;
  pendingScroll: Location;
  pendingAnnotationHighlightId: string;
  openPdfSub: Subscription;
  ready = false;
  object?: FilesystemObject;
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
  addedAnnotationExclusion: AddedAnnotationExclusion;
  addAnnotationExclusionSub: Subscription;
  showExcludedAnnotations = false;
  removeAnnotationExclusionSub: Subscription;
  removedAnnotationExclusion: RemovedAnnotationExclusion;

  @ViewChild(PdfViewerLibComponent, {static: false}) pdfViewerLib;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly fileObjectActions: FilesystemObjectActions,
    protected readonly pdfAnnService: AnnotationsService,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly route: ActivatedRoute,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly workSpaceManager: WorkspaceManager,
  ) {
    this.loadTask = new BackgroundTask(([hashId, loc]) => {
      return combineLatest(
        this.filesystemService.get(hashId, {
          loadContent: true,
        }).pipe(mergeMap(object => combineLatest(
          of(object),
          readBlobAsBuffer(object.contentValue),
        ))),
        this.pdfAnnService.getAnnotations(hashId));
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openPdfSub = this.loadTask.results$.subscribe(({
                                                          result: [[object, content], ann],
                                                          value: [file, loc],
                                                        }) => {
      this.pdfData = {data: new Uint8Array(content)};
      this.annotations = ann;
      this.updateAnnotationIndex();
      this.updateSortedEntityTypeEntries();
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      setTimeout(() => {
        this.ready = true;
      }, 10);
    });

    this.loadFromUrl();
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      const fragment = this.route.snapshot.fragment || '';
      // TODO: Do proper query string parsing
      this.openPdf(linkedFileId,
        this.parseLocationFromUrl(fragment),
        this.parseHighlightFromUrl(fragment));
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
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

  enableEntityTypeVisibility(annotation: Annotation) {
    this.entityTypeVisibilityMap.set(annotation.meta.type, true);
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
    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message = 'Do you want to annotate the rest of the document with this term as well?';
    dialogRef.result.then((annotateAll: boolean) => {
      const progressDialogRef = this.progressDialog.display({
        title: `Adding Annotations`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Adding annotations to the file...',
        })),
      });

      this.addAnnotationSub = this.pdfAnnService.addCustomAnnotation(this.currentFileId, {
        annotation,
        annotateAll,
      })
        .pipe(this.errorHandler.create())
        .subscribe(
          (annotations: Annotation[]) => {
            progressDialogRef.close();
            this.addedAnnotations = annotations;
            this.enableEntityTypeVisibility(annotations[0]);
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
      this.removeAnnotationSub = this.pdfAnnService.removeCustomAnnotation(this.currentFileId, uuid, {
        removeAll,
      })
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

  annotationExclusionAdded(exclusionData: AddedAnnotationExclusion) {
    this.addAnnotationExclusionSub = this.pdfAnnService.addAnnotationExclusion(
      this.currentFileId, {
        exclusion: exclusionData,
      },
    )
      .pipe(this.errorHandler.create())
      .subscribe(
        response => {
          this.addedAnnotationExclusion = exclusionData;
          this.snackBar.open(`${exclusionData.text}: annotation has been excluded`, 'Close', {duration: 10000});
        },
        err => {
          this.snackBar.open(`${exclusionData.text}: failed to exclude annotation`, 'Close', {duration: 10000});
        },
      );
  }

  annotationExclusionRemoved({type, text}) {
    this.removeAnnotationExclusionSub = this.pdfAnnService.removeAnnotationExclusion(this.currentFileId, {
      type,
      text,
    })
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

    const source = `/projects/${encodeURIComponent(this.object.project.name)}`
      + `/files/${encodeURIComponent(this.currentFileId)}`
      + `#page=${loc.pageNumber}&coords=${loc.rect[0]},${loc.rect[1]},${loc.rect[2]},${loc.rect[3]}`;

    const sources = [{
      domain: 'File Source',
      url: source,
    }];

    if (this.object.doi) {
      sources.push({
        domain: 'DOI',
        url: this.object.doi,
      });
    }

    if (this.object.uploadUrl) {
      sources.push({
        domain: 'External URL',
        url: this.object.uploadUrl,
      });
    }

    const hyperlink = meta.idHyperlink || '';

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
          id: this.object.hashId,
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
      },
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
   * @param hashId - represent the pdf to open
   * @param loc - the location of the annotation we want to scroll to
   * @param annotationHighlightId - the ID of an annotation to highlight, if any
   */
  openPdf(hashId: string, loc: Location = null, annotationHighlightId: string = null) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      if (loc) {
        this.scrollInPdf(loc);
      }
      if (annotationHighlightId != null) {
        this.highlightAnnotation(annotationHighlightId);
      }
      return;
    }
    this.pendingScroll = loc;
    this.pendingAnnotationHighlightId = annotationHighlightId;
    this.pdfFileLoaded = false;
    this.ready = false;

    this.loadTask.update([hashId, loc]);
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

  scrollInPdf(loc: Location) {
    if (!this.pdfFileLoaded) {
      console.log('File in the pdf viewer is not loaded yet. So, I cant scroll');
      this.pendingScroll = loc;
      return;
    }
    this.goToPosition.next(loc);
  }

  highlightAnnotation(annotationId: string) {
    if (!this.pdfFileLoaded) {
      this.pendingAnnotationHighlightId = annotationId;
      return;
    }
    if (annotationId != null) {
      for (const annotation of this.annotations) {
        if (annotation.meta.id === annotationId) {
          this.entityTypeVisibilityMap.set(annotation.meta.type, true);
          this.invalidateEntityTypeVisibility();
          break;
        }
      }
    }
    this.highlightAnnotations.next(annotationId);
  }

  loadCompleted(status) {
    this.pdfFileLoaded = status;
    if (this.pdfFileLoaded) {
      if (this.pendingScroll) {
        this.scrollInPdf(this.pendingScroll);
        this.pendingScroll = null;
      }
      if (this.pendingAnnotationHighlightId) {
        this.highlightAnnotation(this.pendingAnnotationHighlightId);
        this.pendingAnnotationHighlightId = null;
      }
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

  searchQueryChangedFromViewer(keyword: string) {
    this.searchQuery = keyword;
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

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'file-pdf',
    });
  }

  parseLocationFromUrl(fragment: string): Location | undefined {
    let pageMatch;
    let coordMatch;
    let jumpMatch;
    const params = new URLSearchParams(fragment);
    pageMatch = params.get('page');
    const coords = params.get('coords');
    if (coords != null) {
      coordMatch = coords.split(/,/g);
    }
    jumpMatch = params.get('jump');
    return {
      pageNumber: pageMatch != null ? parseInt(pageMatch, 10) : null,
      rect: coordMatch != null ? coordMatch.map(parseFloat) : null,
      jumpText: jumpMatch,
    };
  }

  parseHighlightFromUrl(fragment: string): string | undefined {
    if (window.URLSearchParams) {
      const params = new URLSearchParams(fragment);
      return params.get('annotation');
    }
    return null;
  }

  displayShareDialog() {
    return this.fileObjectActions.openShareDialog(this.object);
  }

  openFileNavigatorPane() {
    const url = `/file-navigator/${this.object.project.name}/${this.object.hashId}`;
    this.workSpaceManager.navigateByUrl(url, {sideBySide: true, newTab: true});
  }

  openFileAnnotationHistoryDialog() {
    this.fileObjectActions.openFileAnnotationHistoryDialog(this.object).then(() => {
    }, () => {
    });
  }

  isPendingScroll() {
    return this.pendingScroll != null && this.pendingScroll.pageNumber != null;
  }

  isPendingJump() {
    return this.pendingScroll != null && this.pendingScroll.jumpText != null;
  }

  isPendingPostLoadAction() {
    return this.isPendingScroll() || this.isPendingJump()
      || this.pendingAnnotationHighlightId != null;
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: 'File Source',
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'files', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

}
