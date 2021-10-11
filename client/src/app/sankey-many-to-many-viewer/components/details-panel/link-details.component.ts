import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { SankeyLinkDetailsComponent } from 'app/sankey-viewer/components/details-panel/link-details.component';

import { SankeyManyToManyLink } from '../interfaces';

@Component({
  selector: 'app-sankey-many-to-many-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeyManyToManyLinkDetailsComponent extends SankeyLinkDetailsComponent implements OnChanges {
  @Input() entity: SankeyManyToManyLink;

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }
}

