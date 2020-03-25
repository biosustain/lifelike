import { Component, AfterViewInit } from '@angular/core';
import { FormControl } from '@angular/forms';

import {
  PdfAnnotationsService,
  DataFlowService
} from '../services';

import {
  Annotation
} from '../services/interfaces';

const MOCK_FILES: string[] = [
  'pdf file number 1',
  'pdf file number 2',
  'pdf file number 3',
  'pdf file number 4',
  'pdf file number 5',
  'pdf file number 6',
  'pdf file number 7',
  'pdf file number 8',
  'pdf file number 9',
  'pdf file number 10',
];


@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements AfterViewInit {

  annotations: Object[] = [];
  files: string[] = MOCK_FILES; // TODO: fetch from API endpoint
  filesFilter = new FormControl('');
  filteredFiles = this.files;

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private dataFlow: DataFlowService
  ) {
    this.filesFilter.valueChanges.subscribe((value: string) => {
      this.filteredFiles = this.files.filter(
        (name: string) => name.includes(value.toLocaleLowerCase())
      );
    });
  }

  ngAfterViewInit() {
    setTimeout(
      () => {
        this.pdfAnnService.getMockupAnnotation()
        .subscribe(ann => {
          this.annotations = ann;
        });
      },
      200
    )
  }

  /**
   * Handle drop event from draggable annotations
   * of the pdf-viewer
   * @param event 
   */
  drop(event) {
    const mouseEvent = event['event']['originalEvent']['originalEvent'] as MouseEvent;
    const node_dom = event['ui']['draggable'][0] as HTMLElement;

    const container_coord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;

    const ann_id = node_dom.getAttribute('annotation-id');
    const ann_def: Annotation = this.pdfAnnService.searchForAnnotation(ann_id);

    let pay_load = {
      x: mouseEvent.clientX - container_coord.x,
      y: mouseEvent.clientY,
      label: node_dom.innerText,
      group: (ann_def.type as String).toLocaleLowerCase()
    };

    this.dataFlow.pushNode2Canvas(pay_load);
  }
}
