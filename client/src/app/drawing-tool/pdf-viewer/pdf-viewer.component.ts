import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { BehaviorSubject, combineLatest, Subject, Subscription } from 'rxjs';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { Hyperlink, SearchLink } from 'app/shared/constants';

import { DataFlowService, PdfAnnotationsService, } from '../services';

import { Annotation, GraphData, Location, Meta } from '../services/interfaces';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { FileSelectionDialogComponent } from '../../file-browser/file-selection-dialog.component';
import { BackgroundTask } from '../../shared/rxjs/background-task';
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

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements OnDestroy {
  @Output() requestClose: EventEmitter<any> = new EventEmitter();
  @Output() fileOpen: EventEmitter<PdfFile> = new EventEmitter();

  annotations: Annotation[] = [];

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
      this.pdfData = { data: new Uint8Array(pdfFileContent) };
      this.annotations = ann;
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
        .getElementById('drawing-tool-view-container')
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

    // Convert form plural to singular since annotation
    // .. if no matches are made, return as entity
    const mapper = (plural) => {
      switch (plural) {
        case 'Compounds':
          return 'compound';
        case 'Diseases':
          return 'disease';
        case 'Genes':
          return 'gene';
        case 'Proteins':
          return 'protein';
        case 'Species':
          return 'species';
        case 'Mutations':
            return 'mutation';
        case 'Chemicals':
          return 'chemical';
        case 'Phenotypes':
          return 'phenotype';
        case 'Pathways':
          return 'pathway';
        case 'Companies':
          return 'company';
        default:
          return 'entity';
      }
    };

    const payload: GraphData = {
      x: mouseEvent.clientX - containerCoord.x,
      y: mouseEvent.clientY,
      label: meta.allText,
      group: mapper(meta.type),
      data: {
        source,
        search,
        hyperlink
      }
    };

    this.dataFlow.pushNode2Canvas(payload);
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
}
