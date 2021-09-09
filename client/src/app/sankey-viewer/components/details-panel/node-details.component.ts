import { Component, Input, } from '@angular/core';
import { SankeyDetailsComponent } from './details.component';

@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
// @ts-ignore
export class SankeyNodeDetailsComponent extends SankeyDetailsComponent {
  @Input() entity: SankeyNode;
}
