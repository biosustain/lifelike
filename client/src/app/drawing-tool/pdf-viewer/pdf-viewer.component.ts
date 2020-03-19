import { Component, OnInit, AfterViewInit } from '@angular/core';

import {
  PdfAnnotationsService,
  DataFlowService
} from '../services';

import {
  Annotation,
  GraphData
} from '../services/interfaces';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss']
})
export class PdfViewerComponent implements OnInit, AfterViewInit {

  annotations: Object[] = [];

  constructor(
    private pdfAnnService: PdfAnnotationsService,
    private dataFlow: DataFlowService
  ) { }

  ngOnInit() {
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
    
    let pay_load: GraphData = {
      x: mouseEvent.clientX - container_coord.x,
      y: mouseEvent.clientY,
      label: node_dom.innerText,
      group: (ann_def.type as String).toLocaleLowerCase(),
      hyperlink: this.generateHyperlink(ann_def)
    };

    this.dataFlow.pushNode2Canvas(pay_load);
  }

  generateHyperlink(ann_def: Annotation): string {

    switch (ann_def.type) {
      case 'Chemical':
        let id = ann_def.id.match(/(\d+)/g)[0];
        return `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${id}`;
      case 'Gene':
        return `https://www.ncbi.nlm.nih.gov/gene/?term=${ann_def.id}`;
      default:
        return '';
    }
  }
}
