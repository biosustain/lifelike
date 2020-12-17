import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { WordCloudFilterEntity } from 'app/interfaces/filter.interface';
import {FilterComponent} from '../filter/filter.component';
import {AnnotationFilterComponent} from "../annotation-filter/annotation-filter.component";

@Component({
  selector: 'app-word-cloud-filter',
  templateUrl: './word-cloud-filter.component.html',
  styleUrls: ['./word-cloud-filter.component.scss']
})
export class WordCloudFilterComponent extends AnnotationFilterComponent implements OnInit {
  @Input() clickableWords = false;
  @Input() data: WordCloudFilterEntity[];
  @Output() wordOpen = new EventEmitter<WordCloudFilterEntity>();

  constructor() {
    super();
  }

  ngOnInit() {
    super.ngOnInit();
  }
}
