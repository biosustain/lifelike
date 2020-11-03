import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';

import { AnnotationFilterComponent } from '../annotation-filter/annotation-filter.component';

@Component({
  selector: 'app-word-cloud-annotation-filter',
  templateUrl: './word-cloud-annotation-filter.component.html',
  styleUrls: ['./word-cloud-annotation-filter.component.scss']
})
export class WordCloudAnnotationFilterComponent extends AnnotationFilterComponent implements OnInit {
  @Input() clickableWords = false;
  @Input() annotationData: WordCloudAnnotationFilterEntity[];
  @Output() wordOpen = new EventEmitter<WordCloudAnnotationFilterEntity>();

  NOT_SHOWN_TOOLTIP = 'Could not fit this term in the cloud. Try expanding the window or filtering other terms.';

  constructor() {
    super();
  }

  ngOnInit() {
    super.ngOnInit();
    super.updateVisibility();
  }
}
