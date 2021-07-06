import { Component, EventEmitter, OnDestroy, Output, ViewChild, HostListener, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { uniqueId } from 'lodash';

import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs';

import { ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { BiocFile } from 'app/interfaces/bioc-files.interface';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { map } from 'rxjs/operators';
import { mapBlobToBuffer, mapBufferToJsons } from 'app/shared/utils/files';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { SearchControlComponent } from 'app/shared/components/search-control.component';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { Location, Meta } from 'app/pdf-viewer/annotation-type';
import { SEARCH_LINKS } from 'app/shared/links';


@Component({
  selector: 'app-bioc-viewer',
  templateUrl: './bioc-view.component.html',
  styleUrls: ['./bioc-view.component.scss'],
})
export class BiocViewComponent implements OnDestroy, ModuleAwareComponent {
  @ViewChild('dropdown', { static: false, read: NgbDropdown }) dropdownComponent: NgbDropdown;
  @ViewChild('searchControl', {
    static: false,
    read: SearchControlComponent,
  }) searchControlComponent: SearchControlComponent;
  @Output() requestClose: EventEmitter<any> = new EventEmitter();
  @Output() fileOpen: EventEmitter<BiocFile> = new EventEmitter();

  id = uniqueId('FileViewComponent-');

  paramsSubscription: Subscription;
  returnUrl: string;

  entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Output() filterChangeSubject = new Subject<void>();

  searchChanged: Subject<{ keyword: string, findPrevious: boolean }> = new Subject<{ keyword: string, findPrevious: boolean }>();
  searchQuery = '';
  goToPosition: Subject<Location> = new Subject<Location>();
  highlightAnnotations = new BehaviorSubject<{
    id: string;
    text: string;
  }>(null);
  highlightAnnotationIds: Observable<string> = this.highlightAnnotations.pipe(
    map((value) => value ? value.id : null),
  );
  loadTask: any;
  pendingScroll: Location;
  pendingAnnotationHighlightId: string;
  openbiocSub: Subscription;
  openStatusSub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface biocSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/biocjs-dist/index.d.ts
  biocData: Array<Document>;
  currentFileId: string;
  addAnnotationSub: Subscription;
  removedAnnotationIds: string[];
  removeAnnotationSub: Subscription;
  biocFileLoaded = false;
  entityTypeVisibilityChanged = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  addAnnotationExclusionSub: Subscription;
  showExcludedAnnotations = false;
  removeAnnotationExclusionSub: Subscription;

  matchesCount = {
    current: 0,
    total: 0,
  };
  searching = false;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly fileObjectActions: FilesystemObjectActions,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly route: ActivatedRoute,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly workSpaceManager: WorkspaceManager,
    protected readonly _elemenetRef: ElementRef
  ) {
    this.loadTask = new BackgroundTask(([hashId]) => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJsons()
        )
      );
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openbiocSub = this.loadTask.results$.subscribe(({
      result: [object, content],
      value: [file],
    }) => {
      this.biocData = content.splice(0, 1);
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.openStatusSub = this.loadTask.status$.subscribe((data) => {
      if (data.resultsShown) {
        const fragment = (this.route.snapshot.fragment || '');
        if (fragment.indexOf('offset') >= 0) {
          setTimeout(() => {
            this.scrollInOffset(fragment);
          }, 1000);
        }
      }
    });

    this.loadFromUrl();
  }

  getFigureCaption(passage) {
    return passage.infons.id || 'Fig';
  }

  isGeneric(passage) {
    return !this.isTableView(passage) && !this.isFigure(passage);
  }

  isTableView(passage) {
    const TYPES = ['table', 'table_caption', 'table_footnote'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  isFigure(passage) {
    const TYPES = ['fig_caption'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  buildFigureLink(doc, passage) {
    const pmcid = doc.passages.find(p => p.infons['article-id_pmc']);
    const infons = passage.infons || {};
    const file = infons.file;
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid.infons['article-id_pmc']}/bin/${file}`;
  }

  pmid(doc) {
    const pmid = doc.passages.find(p => p.infons['article-id_pmid']);
    if (pmid) {
      const PMID_LINK = 'https://www.ncbi.nlm.nih.gov/pubmed/' + String(pmid.infons['article-id_pmid']);
      const text = 'PMID' + String(pmid.infons['article-id_pmid']);
      return [text, PMID_LINK];
    }
    const pmc = doc.passages.find(p => p.infons['article-id_pmc']);
    if (pmc) {
      const PMCID_LINK = 'http://www.ncbi.nlm.nih.gov/pmc/articles/pmc' + String(pmc.infons['article-id_pmc']);
      const text = 'PMC' + String(pmc.infons['article-id_pmc']);
      return [text, PMCID_LINK];
    }

    return [];
  }

  journal(doc) {
    const journal = doc.passages.find(p => p.infons[`journal`]);
    if (journal) {
      return journal.infons[`journal`];
    }
  }

  authors(doc) {
    const authors = doc.passages.find(p => p.infons[`authors`]);
    if (authors) {
      return authors.infons[`authors`];
    }
  }

  year(doc) {
    const year = doc.passages.find(p => p.infons[`year`]);
    if (year) {
      return year.infons[`year`];
    }
  }

  title(doc) {
    try {
      return doc.passages.find(p => p.infons.type.toLowerCase() === 'title' || p.infons.section_type.toLowerCase() === 'title').text;
    } catch (e) {
      return doc.pmid;
    }
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
      this.openbioc(linkedFileId);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  isEntityTypeVisible(entityType: EntityType) {
    const value = this.entityTypeVisibilityMap.get(entityType.id);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  scrollInOffset(offset: any) {
    const offsetNum = offset.split('=')[1];
    if (!isNaN(Number(offsetNum))) {
      const query = `span[offset='${offsetNum}']`;
      const annotationElem = this._elemenetRef.nativeElement.querySelector(query);
      if (annotationElem) {
        annotationElem.scrollIntoView({ block: 'center' });
        jQuery(annotationElem).effect('highlight', {
          color: 'red'
        }, 1000);
      }
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

  /**
   * Open bioc by file_id along with location to scroll to
   * @param hashId - represent the bioc to open
   */
  openbioc(hashId: string) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      return;
    }
    this.biocFileLoaded = false;
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  ngOnDestroy() {
    if (this.paramsSubscription) {
      this.paramsSubscription.unsubscribe();
    }
    if (this.openbiocSub) {
      this.openbiocSub.unsubscribe();
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
    if (this.openStatusSub) {
      this.openStatusSub.unsubscribe();
    }
  }

  scrollInbioc(loc: Location) {
    this.pendingScroll = loc;
    if (!this.biocFileLoaded) {
      console.log('File in the bioc viewer is not loaded yet. So, I cant scroll');
      return;
    }
    this.goToPosition.next(loc);
  }

  loadCompleted(status) {
    this.biocFileLoaded = status;
    if (this.pendingScroll) {
      this.scrollInbioc(this.pendingScroll);
    }
    if (this.pendingAnnotationHighlightId) {
      this.pendingAnnotationHighlightId = null;
    }
  }

  close() {
    this.requestClose.emit(null);
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
      fontAwesomeIcon: 'file-bioc',
    });
  }

  parseHighlightFromUrl(fragment: string): string | undefined {
    if (window.URLSearchParams) {
      const params = new URLSearchParams(fragment);
      return params.get('annotation');
    }
    return null;
  }


  openFileNavigatorPane() {
    const url = `/file-navigator/${this.object.project.name}/${this.object.hashId}`;
    this.workSpaceManager.navigateByUrl(url, { sideBySide: true, newTab: true });
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'files', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  @HostListener('document:selectionchange', ['$event'])
  selectionChange(event: Event) {
    console.log('event is ', event);
    const selection = window.getSelection();
    console.log(selection);
  }

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    const meta: any = {};
    const dataTransfer: DataTransfer = event.dataTransfer;
    const txt = (event.target as any).innerHTML;
    const type = (event.target as any).classList[1];
    const id = (event.target as any).attributes[`identifier`].nodeValue;
    const annType = (event.target as any).attributes[`annType`].nodeValue;
    const offset = (event.target as any).attributes[`offset`].nodeValue;
    const src = this.getSource({
      identifier: id,
      type: annType
    });
    const search = [];
    const hyperlinks = [];
    const url = src;
    const domain = new URL(src).hostname.replace(/^www\./i, '');
    const isDatabase = false;
    hyperlinks.push({ url, domain, isDatabase });
    const hyperlink = meta.idHyperlink || '';
    dataTransfer.setData('text/plain', txt);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: txt,
      label: String(type).toLowerCase(),
      sub_labels: [],
      data: {
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'bioc', encodeURIComponent(this.object.hashId)].join('/') + '#offset=' + offset,
        }],
        search,
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId,
        }, {
          type: 'DATABASE',
          url: hyperlink,
        }],
        hyperlinks,
        detail: meta.type === 'link' ? meta.allText : '',
      },
      style: {
        showDetail: meta.type === 'link',
      },
    } as Partial<UniversalGraphNode>));

    event.stopPropagation();
  }

  getSource(payload: any = {}) {
    const identifier = payload.identifier || payload.Identifier;
    const type = payload.type;

    // MESH Handling
    if (identifier && identifier.toLowerCase().startsWith('mesh')) {
      const mesh = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === 'mesh');
      const url = mesh.url;
      const idPart = identifier.split(':');
      return url.replace(/%s/, encodeURIComponent(idPart[1]));
    }

    // NCBI
    if (identifier && !isNaN(Number(identifier))) {
      let domain = 'ncbi';
      if (type === 'Species') {
        domain = 'ncbi_taxonomy';
      }
      const mesh = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === domain);
      const url = mesh.url;
      return url.replace(/%s/, encodeURIComponent(identifier));
    }
    const fallback = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === 'google');
    return fallback.url.replace(/%s/, encodeURIComponent(identifier));
  }
}

