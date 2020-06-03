import { Component, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { combineLatest, Subject, Subscription } from 'rxjs';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { Hyperlink, SearchLink } from 'app/shared/constants';

import { DataFlowService, PdfAnnotationsService, } from '../services';

import { Annotation, Location, Meta, UniversalGraphNode } from '../services/interfaces';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { FileSelectionDialogComponent } from '../../file-browser/file-selection-dialog.component';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { PdfViewerLibComponent } from '../../pdf-viewer/pdf-viewer-lib.component';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { MatCheckboxChange } from '@angular/material';
import { ActivatedRoute } from '@angular/router';

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
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements OnDestroy {
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

  searchChanged: Subject<string> = new Subject<string>();
  goToPosition: Subject<Location> = new Subject<Location>();
  loadTask: BackgroundTask<[PdfFile, Location], [ArrayBuffer, any]> =
    new BackgroundTask(([file, loc]) => {
      return combineLatest(
        this.pdf.getFile(file.file_id),
        this.pdfAnnService.getFileAnnotations(file.file_id)
      );
    });
  pendingScroll: Location;
  openPdfSub: Subscription;
  pdfViewerReady = false;
  // Type information coming from interface PDFSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pdfjs-dist/index.d.ts
  pdfData: { url?: string, data?: Uint8Array };
  currentFileId: string;
  addedAnnotation: Annotation;
  addAnnotationSub: Subscription;
  pdfFileLoaded = false;
  sortedEntityTypeEntries = [];
  entityTypeVisibilityChanged = false;

  // search
  pdfQuery;

  @ViewChild(PdfViewerLibComponent, { static: false }) pdfViewerLib;

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private pdf: PdfFilesService,
    private snackBar: MatSnackBar,
    private dataFlow: DataFlowService,
    public dialog: MatDialog,
    private route: ActivatedRoute
  ) {
    // Listener for file open
    this.openPdfSub = this.loadTask.observable.subscribe(([[pdfFileContent, ann], [file, loc]]) => {
      this.pdfData = {data: new Uint8Array(pdfFileContent)};
      this.annotations = ann;
      this.updateAnnotationIndex();
      this.updateSortedEntityTypeEntries();

      this.currentFileId = file.file_id;
      setTimeout(() => {
        this.pdfViewerReady = true;
      }, 10);
    });

    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      const linkedFileId = this.route.snapshot.params.file_id;
      this.openPdf(new DummyFile(linkedFileId));
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
      this.entityTypeVisibilityMap.set(type.name, state);
    }
    this.invalidateEntityTypeVisibility();
  }

  changeEntityTypeVisibility(entityType: EntityType, event: MatCheckboxChange) {
    this.entityTypeVisibilityMap.set(entityType.id, event.checked);
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
    if (!this.pdfViewerReady) {
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

    const annotationToAdd = {
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
        }
      }
    };

    annotationToAdd.meta.idHyperlink = this.generateHyperlink(annotationToAdd);

    this.addAnnotationSub = this.pdfAnnService.addCustomAnnotation(this.currentFileId, annotationToAdd).subscribe(
      response => {
        this.addedAnnotation = annotationToAdd;
        this.snackBar.open('Annotation has been added', 'Close', {duration: 5000});
      },
      err => {
        this.snackBar.open(`Error: failed to add annotation`, 'Close', {duration: 10000});
      }
    );

    this.addedAnnotations.push(annotation);
    this.updateAnnotationIndex();
    this.updateSortedEntityTypeEntries();
  }

  /**
   * Handle drop event from draggable annotations
   * of the pdf-viewer
   * @param event represents a drop event
   */
  drop(event) {
    const mouseEvent = event.event.originalEvent.originalEvent as MouseEvent;
    const nodeDom = event.ui.draggable[0] as HTMLElement;

    const containerCoord: DOMRect =
      document
        .getElementById('drawing-tool-view-canvas')
        .getBoundingClientRect() as DOMRect;

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
        url: meta.links[k]
      };
    });

    this.dataFlow.pushNode2Canvas({
      hash: '', // To be replaced
      display_name:  meta.type === 'Links' ? 'Link' : meta.allText,
      label: meta.type.toLowerCase(),
      sub_labels: [],
      data: {
        x: mouseEvent.clientX - containerCoord.x,
        y: mouseEvent.clientY,
        source,
        search,
        hyperlink,
        detail: meta.type === 'Link' ? meta.allText : ''
      }
    });
  }

  openFileDialog() {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.width = '600px';
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {};

    const dialogRef = this.dialog.open(FileSelectionDialogComponent, dialogConfig);
    dialogRef.beforeClosed().subscribe((file: PdfFile) => {
      if (file !== null) {
        this.openPdf(file);
      }
    });
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
    this.pdfViewerReady = false;

    this.loadTask.update([file, loc]);
  }

  ngOnDestroy() {
    if (this.openPdfSub) {
      this.openPdfSub.unsubscribe();
    }
    if (this.addAnnotationSub) {
      this.addAnnotationSub.unsubscribe();
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
    this.searchChanged.next(query);
  }

}
