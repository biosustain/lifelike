import { Component, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { combineLatest, Subject, Subscription, throwError } from 'rxjs';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { Hyperlink, SearchLink } from 'app/shared/constants';

import { PdfAnnotationsService } from '../../drawing-tool/services';

import { Annotation, Location, Meta, AnnotationExclusionData, UniversalGraphNode } from '../../drawing-tool/services/interfaces';

import { MatSnackBar } from '@angular/material/snack-bar';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { PdfViewerLibComponent } from '../../pdf-viewer/pdf-viewer-lib.component';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ActivatedRoute } from '@angular/router';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { ConfirmDialogComponent } from '../../shared/components/dialog/confirm-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { catchError } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { HttpErrorResponse } from '@angular/common/http';
import { UserError } from 'app/shared/exceptions';

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
  @Output() requestClose: EventEmitter<any> = new EventEmitter();
  @Output() fileOpen: EventEmitter<PdfFile> = new EventEmitter();

  annotations: Annotation[] = [];
  // We don't want to modify the above array when we add annotations, because
  // data flow right now is very messy
  addedAnnotations: Annotation[] = [];
  /**
   * A mapping of annotation type (i.e. Genes) to a list of those annotations.
   */
  annotationEntityTypeMap: Map<string, Annotation[]> = new Map();
  entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Output() filterChangeSubject = new Subject<void>();
  filterPopupOpen = false;

  searchChanged: Subject<{ keyword: string, findPrevious: boolean }> = new Subject<{ keyword: string, findPrevious: boolean }>();
  goToPosition: Subject<Location> = new Subject<Location>();
  loadTask: BackgroundTask<[PdfFile, Location], [PdfFile, ArrayBuffer, any]>;
  pendingScroll: Location;
  openPdfSub: Subscription;
  ready = false;
  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  pdfData: { url?: string, data?: Uint8Array };
  currentFileId: string;
  addedAnnotation: Annotation;
  addAnnotationSub: Subscription;
  removedAnnotationIds: string[];
  removeAnnotationSub: Subscription;
  pdfFileLoaded = false;
  sortedEntityTypeEntries: EntityTypeEntry[] = [];
  entityTypeVisibilityChanged = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  addedAnnotationExclusion: AnnotationExclusionData;
  addAnnotationExclusionSub: Subscription;
  showExcludedAnnotations = false;
  removeAnnotationExclusionSub: Subscription;
  removedAnnotationExclusionId: string;

  // search
  pdfQuery;

  @ViewChild(PdfViewerLibComponent, {static: false}) pdfViewerLib;

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private pdf: PdfFilesService,
    private snackBar: MatSnackBar,
    private readonly modalService: NgbModal,
    private route: ActivatedRoute,
    private readonly errorHandler: ErrorHandler,
  ) {
    this.loadTask = new BackgroundTask(([file, loc]) => {
      return combineLatest(
        this.pdf.getFileInfo(file.file_id),
        this.pdf.getFile(file.file_id),
        this.pdfAnnService.getFileAnnotations(file.file_id),
      ).pipe(errorHandler.create());
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
      this.modulePropertiesChange.next({
        title: pdfFile.filename,
        fontAwesomeIcon: 'file-pdf',
      });

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
      const pageMatch = fragment.match(/page=([0-9]+)/);
      const coordMatch = fragment.match(/coords=([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);
      const location: Location = pageMatch != null && coordMatch != null ? {
        pageNumber: parseInt(pageMatch[1], 10),
        rect: [
          parseFloat(coordMatch[1]),
          parseFloat(coordMatch[2]),
          parseFloat(coordMatch[3]),
          parseFloat(coordMatch[4])
        ]
      } : null;
      this.openPdf(new DummyFile(linkedFileId), location);
    }
  }

  updateAnnotationIndex() {
    // Create index of annotation types
    this.annotationEntityTypeMap.clear();
    for (const annotation of [...this.annotations, ...this.addedAnnotations]) {
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

  toggleFilterPopup() {
    if (!this.ready) {
      return;
    }
    this.filterPopupOpen = !this.filterPopupOpen;
  }

  closeFilterPopup() {
    this.filterPopupOpen = false;
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
        id,
        idType,
        links: {
          ncbi: annotation.meta.links.ncbi || this.buildUrl(SearchLink.Ncbi, annotation.meta.allText),
          uniprot: annotation.meta.links.uniprot || this.buildUrl(SearchLink.Uniprot, annotation.meta.allText),
          wikipedia: annotation.meta.links.wikipedia || this.buildUrl(SearchLink.Wikipedia, annotation.meta.allText),
          google: annotation.meta.links.google || this.buildUrl(SearchLink.Google, annotation.meta.allText),
        },
      },
    };

    annotationToAdd.meta.idHyperlink = this.generateHyperlink(annotationToAdd);

    this.addAnnotationSub = this.pdfAnnService.addCustomAnnotation(this.currentFileId, annotationToAdd).subscribe(
      response => {
        this.addedAnnotation = Object.assign({}, annotationToAdd, {uuid: response.uuid});
        this.snackBar.open('Annotation has been added', 'Close', {duration: 5000});
      },
      err => {
        this.snackBar.open(`Error: failed to add annotation`, 'Close', {duration: 10000});
      },
    );

    this.addedAnnotations.push(annotation);
    this.updateAnnotationIndex();
    this.updateSortedEntityTypeEntries();
  }

  annotationRemoved(uuid) {
    const dialogRef = this.modalService.open(ConfirmDialogComponent);
    dialogRef.componentInstance.message = 'Do you want to remove all matching annotations from the file as well?';
    dialogRef.result.then((removeAll: boolean) => {
      this.removeAnnotationSub = this.pdfAnnService.removeCustomAnnotation(this.currentFileId, uuid, removeAll).subscribe(
        response => {
          this.removedAnnotationIds = [];
          let msg = 'Removal completed';
          for (const [id, status] of Object.entries(response)) {
            if (status === 'Removed') {
              this.removedAnnotationIds.push(id);
            } else {
              msg = `${msg}, but one or more annotations could not be removed because you are not the owner`;
            }
          }
          this.snackBar.open(msg, 'Close', {duration: 10000});
        },
        err => {
          this.snackBar.open(`Error: removal failed`, 'Close', {duration: 10000});
        },
      );
    }, () => {
    });
  }

  annotationExclusionAdded({ id, reason, comment }) {
    this.addAnnotationExclusionSub = this.pdfAnnService.addAnnotationExclusion(this.currentFileId, id, reason, comment).subscribe(
      response => {
        this.addedAnnotationExclusion = { id, reason, comment };
        this.snackBar.open('Annotation has been excluded', 'Close', {duration: 5000});
      },
      err => {
        this.snackBar.open(`Error: failed to exclude annotation`, 'Close', {duration: 10000});
      }
    );
  }

  annotationExclusionRemoved(id) {
    this.removeAnnotationExclusionSub = this.pdfAnnService.removeAnnotationExclusion(this.currentFileId, id).subscribe(
      response => {
        this.removedAnnotationExclusionId = id;
        this.snackBar.open('Unmarked successfully', 'Close', {duration: 5000});
      },
      err => {
        const { message, name } = err.error.apiHttpError;
        this.snackBar.open(`${name}: ${message}`, 'Close', {duration: 10000});
      }
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

    let source = '/dt/pdf/' + `${this.currentFileId}/${loc.pageNumber}/`;
    source = source + `${loc.rect[0]}/${loc.rect[1]}/${loc.rect[2]}/${loc.rect[3]}`;

    const hyperlink = meta.idHyperlink || '';
    const search = Object.keys(meta.links || []).map(k => {
      return {
        domain: k,
        url: meta.links[k],
      };
    });

    const text = meta.type === 'Links' ? 'Link' : meta.allText;

    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', text);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: text,
      label: meta.type.toLowerCase(),
      sub_labels: [],
      data: {
        source,
        search,
        hyperlink,
        detail: meta.type === 'Link' ? meta.allText : '',
      },
    } as Partial<UniversalGraphNode>));
  }

  zoomIn() {
    this.pdfViewerLib.incrementZoom(0.1);
  }

  zoomOut() {
    this.pdfViewerLib.incrementZoom(-0.1);
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
      case 'CHEBI':
        return this.buildUrl(Hyperlink.Chebi, ann.meta.id);
      case 'MESH':
        // prefix 'MESH:' should be removed from the id in order for search to work
        return this.buildUrl(Hyperlink.Mesh, ann.meta.id.substring(5));
      case 'UNIPROT':
        return this.buildUrl(Hyperlink.Uniprot, ann.meta.id);
      case 'NCBI':
        if (ann.meta.type === 'Genes') {
          return this.buildUrl(Hyperlink.NcbiGenes, ann.meta.id);
        } else if (ann.meta.type === 'Species') {
          return this.buildUrl(Hyperlink.NcbiSpecies, ann.meta.id);
        }
        return '';
      default:
        return '';
    }
  }

  private buildUrl(provider: Hyperlink | SearchLink, query: string): string {
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

  searchQueryChanged(query) {
    this.searchChanged.next({
      keyword: query,
      findPrevious: false,
    });
  }

  findNext(query) {
    this.searchChanged.next({
      keyword: query,
      findPrevious: false,
    });
  }

  findPrevious(query) {
    this.searchChanged.next({
      keyword: query,
      findPrevious: true,
    });
  }

}
