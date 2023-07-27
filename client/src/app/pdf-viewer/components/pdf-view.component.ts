import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { isEqual, uniqueId } from 'lodash-es';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  Observable,
  of,
  Subject,
  Subscription,
  iif,
} from 'rxjs';
import { distinctUntilChanged, first, map, switchMap, tap } from 'rxjs/operators';

import { Progress } from 'app/interfaces/common-dialog.interface';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/module_interfaces';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { mapBlobToBuffer } from 'app/shared/utils/files';
import { SearchControlComponent } from 'app/shared/components/search-control.component';
import { ErrorResponse } from 'app/shared/schemas/common';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { AppURL } from 'app/shared/utils/url';
import { mapIterable, findEntriesValue, findEntriesKey } from 'app/shared/utils';

import {
  AddedAnnotationExclusion,
  Annotation,
  Location,
  RemovedAnnotationExclusion,
} from '../annotation-type';
import {
  AnnotationDragEvent,
  AnnotationHighlightResult,
  PdfViewerLibComponent,
} from '../pdf-viewer-lib.component';
import { PDFAnnotationService } from '../services/pdf-annotation.service';
import { PDFSearchService } from '../services/pdf-search.service';

type EntityTypeVisibilityMap = Map<string, boolean>;
type ReadonlyEntityTypeVisibilityMap = ReadonlyMap<string, boolean>;

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-view.component.html',
  styleUrls: ['./pdf-view.component.scss'],
  providers: [ModuleContext, PDFAnnotationService, PDFSearchService],
})
export class PdfViewComponent implements OnDestroy, OnInit, ModuleAwareComponent {
  encodeURIComponent = encodeURIComponent;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly fileObjectActions: FilesystemObjectActions,
    readonly pdfAnnService: PDFAnnotationService,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly route: ActivatedRoute,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly workSpaceManager: WorkspaceManager,
    protected readonly moduleContext: ModuleContext,
    readonly search: PDFSearchService
  ) {
    moduleContext.register(this);

    this.pdfAnnService.annotationHighlightChange$.subscribe(() =>
      this.searchControlComponent?.focus()
    );

    this.loadTask = new BackgroundTask(([hashId, loc]) =>
      combineLatest(
        this.filesystemService.open(hashId),
        this.filesystemService.getContent(hashId).pipe(mapBlobToBuffer()),
        this.pdfAnnService.getAnnotations(hashId)
      )
    );

    this.paramsSubscription = this.route.queryParams.subscribe((params) => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openPdfSub = this.loadTask.results$.subscribe(
      ({ result: [object, content, ann], value: [file, loc] }) => {
        this.pdfData = { data: new Uint8Array(content) };
        this.pdfAnnService.annotations$.next(ann);
        this.object = object;
        this.emitModuleProperties();

        this.currentFileId = object.hashId;
        this.ready = true;
      }
    );

    this.loadFromUrl();
  }

  @ViewChild('dropdown', { static: false, read: NgbDropdown }) dropdownComponent: NgbDropdown;
  @ViewChild('searchControl', {
    static: false,
    read: SearchControlComponent,
  })
  searchControlComponent: SearchControlComponent;
  @Output() requestClose: EventEmitter<null> = new EventEmitter();
  @Output() fileOpen: EventEmitter<PdfFile> = new EventEmitter();

  id = uniqueId('FileViewComponent-');

  paramsSubscription: Subscription;
  returnUrl: string;
  goToPosition$: Subject<Location> = new Subject<Location>();
  loadTask: BackgroundTask<[string, Location], [FilesystemObject, ArrayBuffer, Annotation[]]>;
  pendingScroll: Location;
  openPdfSub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  pdfData: { url?: string; data?: Uint8Array };
  currentFileId: string;
  pdfFileLoaded = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  showExcludedAnnotations = false;

  @ViewChild(PdfViewerLibComponent, { static: false }) pdfViewerLib: PdfViewerLibComponent;

  dragTitleData$ = defer(() => {
    const sources: Source[] = this.object.getGraphEntitySources();

    return of({
      'text/plain': this.object.filename,
      'application/***ARANGO_DB_NAME***-node': JSON.stringify({
        display_name: this.object.filename,
        label: 'link',
        sub_labels: [],
        data: {
          references: [
            {
              type: 'PROJECT_OBJECT',
              id: this.object.hashId + '',
            },
          ],
          sources,
        },
      } as Partial<UniversalGraphNode>),
      ...GenericDataProvider.getURIs([
        {
          uri: this.object.getURL(false).toAbsolute(),
          title: this.object.filename,
        },
      ]),
    });
  });

  sourceData$ = defer(() => of(this.object?.getGraphEntitySources()));

  private entityTypeVisibilityMapChange$: Subject<EntityTypeVisibilityMap> = new BehaviorSubject(
    new Map(ENTITY_TYPES.map(({ id }) => [id, true]))
  );
  entityTypeVisibilityMap$: Observable<ReadonlyEntityTypeVisibilityMap> =
    this.entityTypeVisibilityMapChange$.pipe(distinctUntilChanged(isEqual));
  sortedEntityTypeEntriesVisibilityMap$ = combineLatest([
    this.pdfAnnService.sortedEntityTypeEntries$,
    this.entityTypeVisibilityMap$,
  ]).pipe(
    map(
      ([sortedEntityTypeEntries, entityTypeVisibilityMap]) =>
        new Map(
          sortedEntityTypeEntries.map((entry) => [
            entry,
            entityTypeVisibilityMap.get(entry.type.id),
          ])
        )
    )
  );
  entityTypeVisibilityMapContainsUnchecked$ = this.entityTypeVisibilityMap$.pipe(
    map((etvm) => findEntriesKey(etvm, (v) => !v)),
    distinctUntilChanged()
  );
  highlightController$ = this.pdfAnnService.annotationHighlightChange$.pipe(
    switchMap((annotationHighlight) =>
      iif(
        () => Boolean(annotationHighlight?.index$),
        annotationHighlight?.index$.pipe(
          map((highlightedAnnotationIndex) => ({
            type: 'annotation',
            value: annotationHighlight.firstAnnotation?.meta.allText || annotationHighlight.id,
            changeValue: (value) => this.pdfAnnService.highlightAllAnnotations(value),
            color: this.getAnnotationBackground(annotationHighlight.firstAnnotation),
            index: highlightedAnnotationIndex,
            total: annotationHighlight.found,
            prev: () => this.pdfAnnService.previousAnnotationHighlight(),
            next: () => this.pdfAnnService.nextAnnotationHighlight(),
          }))
        ),
        combineLatest([this.search.query$, this.search.resultSummary$]).pipe(
          map(([query, { searching, matchesCount }]) => ({
            type: 'search',
            value: query,
            changeValue: (value) => this.search.query$.next(value),
            searching: searching ?? false,
            index: (matchesCount.current || 1) - 1,
            total: matchesCount.total || 0,
            prev: () => this.search.prev$.next(),
            next: () => this.search.next$.next(),
          }))
        )
      )
    )
  );

  ngOnInit() {
    this.pdfAnnService.foundHighlightAnnotations$.subscribe((foundHighlightAnnotations) => {
      const foundHighlightAnnotationsTypes = new Set(
        foundHighlightAnnotations?.annotations?.map((ann) => ann.meta.type)
      );
      this.updateEntityTypeVisibilityMap((etvm) =>
        mapIterable(etvm, ([id, state]) => [id, foundHighlightAnnotationsTypes.has(id) || state])
      );
    });
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
      this.openPdf(
        linkedFileId,
        this.parseLocationFromUrl(fragment),
        this.parseHighlightFromUrl(fragment)
      );
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  closeFilterPopup() {
    this.dropdownComponent.close();
  }

  /**
   * Handle drop event from draggable annotations
   * of the pdf-viewer
   * @param event represents a drop event
   */
  addAnnotationDragData(event: AnnotationDragEvent) {
    const loc = event.location;
    const meta = event.meta;

    const source =
      `/projects/${encodeURIComponent(this.object.project.name)}` +
      `/files/${encodeURIComponent(this.currentFileId)}` +
      `#page=${loc.pageNumber}&coords=${loc.rect[0]},${loc.rect[1]},${loc.rect[2]},${loc.rect[3]}`;

    const sources = [
      {
        domain: this.object.filename,
        url: source,
      },
    ];

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

    const hyperlinks = [];
    const hyperlink = meta.idHyperlinks || [];

    for (const link of hyperlink) {
      const { label, url } = JSON.parse(link);
      hyperlinks.push({
        domain: label,
        url,
      });
    }

    const search = Object.keys(meta.links || []).map((k) => {
      return {
        domain: k,
        url: meta.links[k],
      };
    });

    const text = meta.type === 'link' ? 'Link' : meta.allText;

    const dataTransfer: DataTransfer = event.event.dataTransfer;
    dataTransfer.setData('text/plain', meta.allText);
    GenericDataProvider.setURIs(dataTransfer, [
      {
        title: text,
        uri: new AppURL(source).toAbsolute(),
      },
    ]);
    dataTransfer.setData(
      'application/***ARANGO_DB_NAME***-node',
      JSON.stringify({
        display_name: text,
        label: meta.type.toLowerCase(),
        sub_labels: [],
        data: {
          sources,
          search,
          references: [
            {
              type: 'PROJECT_OBJECT',
              id: this.object.hashId,
            },
            {
              type: 'DATABASE',
              // assumes first link will be main database source link
              // tslint ignore cause other option is destructuring and that
              // also gets name shadowing error
              url: hyperlink.length > 0 ? JSON.parse(hyperlink[0]).url : '',
            },
          ],
          hyperlinks,
          detail: meta.type === 'link' ? meta.allText : '',
        },
        style: {
          showDetail: meta.type === 'link',
        },
      } as Partial<UniversalGraphNode>)
    );
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
    this.pendingScroll = loc;
    if (this.object != null && this.currentFileId === this.object.hashId) {
      if (loc) {
        this.scrollInPdf(loc);
      }
      if (annotationHighlightId != null) {
        this.pdfAnnService.highlightAnnotation(annotationHighlightId);
      }
      return;
    }
    this.pdfAnnService.highlightAllAnnotations(annotationHighlightId);
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
  }

  scrollInPdf(loc: Location) {
    this.pendingScroll = loc;
    if (!this.pdfFileLoaded) {
      console.log('File in the pdf viewer is not loaded yet. So, I cant scroll');
      return;
    }
    this.goToPosition$.next(loc);
  }

  goToPositionVisit(loc: Location) {
    this.pendingScroll = null;
  }

  setAllEntityTypesVisibility(state: boolean) {
    return this.updateEntityTypeVisibilityMap((etvm) => mapIterable(etvm, ([id]) => [id, state]));
  }

  updateEntityTypeVisibilityMap(
    callback: (currentMap: ReadonlyEntityTypeVisibilityMap) => EntityTypeVisibilityMap
  ) {
    return this.entityTypeVisibilityMap$
      .pipe(
        first(),
        tap((etvm) => {
          this.entityTypeVisibilityMapChange$.next(callback(etvm));
        })
      )
      .toPromise();
  }

  changeEntityTypeVisibility(entityTypeId: string, visible: boolean) {
    return this.updateEntityTypeVisibilityMap((etvm) => {
      const newEntityTypeVisibilityMap = new Map(etvm);
      newEntityTypeVisibilityMap.set(entityTypeId, visible);
      return newEntityTypeVisibilityMap;
    });
  }

  loadCompleted(status) {
    this.pdfFileLoaded = status;
    if (this.pendingScroll) {
      this.scrollInPdf(this.pendingScroll);
    }
  }

  close() {
    this.requestClose.emit(null);
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

  openFileAnnotationHistoryDialog() {
    this.fileObjectActions.openFileAnnotationHistoryDialog(this.object).then(
      () => {},
      () => {}
    );
  }

  openNewWindow() {
    return this.fileObjectActions.openNewWindow(this.object);
  }

  isPendingScroll() {
    return this.pendingScroll != null && this.pendingScroll.pageNumber != null;
  }

  isPendingJump() {
    return this.pendingScroll != null && this.pendingScroll.jumpText != null;
  }

  isPendingPostLoadAction() {
    return this.isPendingScroll() || this.isPendingJump();
  }

  highlightAnnotation(id) {
    return this.pdfAnnService.highlightAnnotation(id);
  }

  getAnnotationBackground(an: Annotation | undefined) {
    if (an != null) {
      return ENTITY_TYPE_MAP[an.meta.type].color;
    } else {
      return null;
    }
  }
}
