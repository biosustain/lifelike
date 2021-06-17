import { Component, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
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

    this.loadFromUrl();
  }

  isSubHeader(passage) {
    const subSections = ['INTRO', 'ABSTRACT', 'CONCL', 'REF'];
    const ALLOWED_TYPES = ['title_1', 'abstract_title_1', 'title_1', 'title'];
    const infons = passage.infons || {};
    const sectionType = infons.section_type.to_upper();
    const type = infons.type.to_lower();
    const res = subSections.includes(sectionType) && ALLOWED_TYPES.includes(type);
    return res;
  }

  isTitle2(passage) {
    const subSections = ['INTRO', 'ABSTRACT', ];
    const ALLOWED_TYPES = ['title_2'];
    const infons = passage.infons || {};
    const sectionType = infons.section_type;
    const type = infons.type;
    const res = subSections.includes(sectionType) && ALLOWED_TYPES.includes(type);
    return res;
  }

  isParagraph(passage) {
    const TYPES = ['paragraph', 'abstract'];
    const infons = passage.infons || {};
    const type = infons.type;
    const res = TYPES.includes(type);
    return res;
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
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'files', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }
}

