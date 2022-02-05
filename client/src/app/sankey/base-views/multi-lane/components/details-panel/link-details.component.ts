import { Component, Input } from '@angular/core';

import { SankeyLink } from 'app/sankey/interfaces';

import { SankeyDetailsComponent } from '../../../../abstract/details.component';

@Component({
  selector: 'app-sankey-link-details',
  templateUrl: './link-details.component.html'
})
export class SankeyLinkDetailsComponent extends SankeyDetailsComponent {
  @Input() entity: SankeyLink;
}

