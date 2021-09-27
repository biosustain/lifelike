import { Component, Input } from '@angular/core';

import { SankeyDetailsComponent } from './details.component';
import { SankeyLink } from '../interfaces';

@Component({
  selector: 'app-sankey-link-details',
  templateUrl: './link-details.component.html'
})
export class SankeyLinkDetailsComponent extends SankeyDetailsComponent {
  @Input() entity: SankeyLink;
}

