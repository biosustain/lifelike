import { Component, Input, } from '@angular/core';
import { SankeyDetailsComponent } from './details.component';
import { SankeyControllerService } from '../../services/sankey-controller.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
// @ts-ignore
export class SankeyNodeDetailsComponent extends SankeyDetailsComponent {
  @Input() entity: SankeyNode;

  constructor(
    // Same injection but make sankeyController scope on this component
    private sankeyController: SankeyControllerService,
    protected readonly route: ActivatedRoute
  ) {
    super(sankeyController, route);
  }

  get options() {
    return this.sankeyController.options;
  }
}
