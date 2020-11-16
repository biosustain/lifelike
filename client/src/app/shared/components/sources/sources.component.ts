import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Hyperlink } from 'app/drawing-tool/services/interfaces';

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
})
export class SourcesComponent implements OnInit {

  @Input() links: Hyperlink[] | undefined;
  @Output() executeFileSource = new EventEmitter<string>();

  constructor() {
  }

  ngOnInit() {
  }

  normalizeDomainDisplay(domain: string) {
    if (domain === 'Upload URL') {
      return 'External URL';
    } else {
      return domain;
    }
  }

}
