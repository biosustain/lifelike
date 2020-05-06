import { Component, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription, Subject, combineLatest, BehaviorSubject } from 'rxjs';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HYPERLINKS } from 'app/shared/constants';

import {
  PdfAnnotationsService, DataFlowService,
} from '../services';

import {
  Annotation, Location, Meta, GraphData
} from '../services/interfaces';

import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})

export class PdfViewerComponent implements OnDestroy {

  annotations: Annotation[] = [];
  files: PdfFile[] = [];
  filesFilter = new FormControl('');
  filesFilterSub: Subscription;
  filteredFiles = this.files;

  goToPosition: Subject<Location> = new Subject<Location>();
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
    private dataFlow: DataFlowService
  ) {
    this.filesFilterSub = this.filesFilter.valueChanges.subscribe(this.updateFilteredFiles);
    this.pdf.getFiles().subscribe((files: PdfFile[]) => {
      this.files = files;
      this.updateFilteredFiles(this.filesFilter.value);
    });
    // Handles opening a pdf from other pages
    const fileId = localStorage.getItem('fileIdForPdfViewer');
    if (fileId) {
      localStorage.removeItem('fileIdForPdfViewer');
      this.openPdf(fileId);
    }
  }

  annotationCreated(annotation: Annotation) {
    const defaultLinks = {
      ncbi: 'https://www.ncbi.nlm.nih.gov/gene/?query=',
      uniprot: 'https://www.uniprot.org/uniprot/?query=',
      wikipedia: 'https://www.google.com/search?q=site:+wikipedia.org+',
      google: 'https://www.google.com/search?q='
    };

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
          ncbi: annotation.meta.links.ncbi || defaultLinks.ncbi + annotation.meta.allText,
          uniprot: annotation.meta.links.uniprot || defaultLinks.uniprot + annotation.meta.allText,
          wikipedia: annotation.meta.links.wikipedia || defaultLinks.wikipedia + annotation.meta.allText,
          google: annotation.meta.links.google || defaultLinks.google + annotation.meta.allText
        }
      }
    };

    this.addAnnotationSub = this.pdfAnnService.addCustomAnnotation(this.currentFileId, annotationToAdd).subscribe(
      response => {
        this.addedAnnotation = annotationToAdd;
        this.snackBar.open('Annotation has been added', 'Close', { duration: 5000 });
      },
      err => {
        this.snackBar.open(`Error: failed to add annotation`, 'Close', { duration: 10000 });
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

    const getUrl = window.location;
    let hyperlink = getUrl.protocol + '//' + getUrl.host + '/dt/link/';
    hyperlink = hyperlink + `${this.currentFileId}/${loc.pageNumber}/`;
    hyperlink = hyperlink + `${loc.rect[0]}/${loc.rect[1]}/${loc.rect[2]}/${loc.rect[3]}`;

    const payload: GraphData = {
      x: mouseEvent.clientX - containerCoord.x,
      y: mouseEvent.clientY,
      label: meta.allText,
      group: 'link',
      hyperlink
    };

    this.dataFlow.pushNode2Canvas(payload);
  }

  private updateFilteredFiles = (name: string) => {
    const words = name.split(' ').filter(w => w.length).map(w => w.toLocaleLowerCase());
    this.filteredFiles = words.length
      ? this.files.filter((file: PdfFile) => words.some(w => file.filename.toLocaleLowerCase().includes(w)))
      : this.files;
  }

  openPdf(id: string, loc: Location= null) {
    if (this.currentFileId === id) {
      if (loc) {
        this.scrollInPdf(loc);
      }
      return;
    }
    this.pendingScroll = loc;
    this.pdfFileLoaded = false;
    this.pdfViewerReady = false;
    this.openPdfSub = combineLatest(
      this.pdf.getFile(id),
      this.pdfAnnService.getFileAnnotations(id)
    ).subscribe(([pdf, ann]) => {
      this.pdfData = { data: new Uint8Array(pdf) };
      this.annotations = ann;
      this.annotations.forEach(annotation => {
        annotation.meta.hyperlink = this.generateHyperlink(annotation);
      });
      this.currentFileId = id;
      setTimeout(() => {
        this.pdfViewerReady = true;
      }, 10);
    });
  }

  ngOnDestroy() {
    this.filesFilterSub.unsubscribe();
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
        return HYPERLINKS.CHEBI + ann.meta.id;
      case 'MESH':
        // prefix 'MESH:' should be removed from the id in order for search to work
        return HYPERLINKS.MESH + ann.meta.id.substring(5);
      case 'UNIPROT':
        // Note: UNIPROT links will not work as currently there are names in the id fields
        return HYPERLINKS + ann.meta.id;
      case 'NCBI':
        if (ann.meta.type === 'Genes') {
          return HYPERLINKS.NCBI_GENES + ann.meta.id;
        } else if (ann.meta.type === 'Species') {
          return HYPERLINKS.NCBI_SPECIES + ann.meta.id;
        }
        return '';
      default:
        return '';
    }
  }

  scrollInPdf(loc: Location) {
    if (!this.pdfFileLoaded) {
      console.log('File in the pdf viewer is not loaded yet. So, I cant scroll');
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
}
