import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-route-builder',
  templateUrl: './route-builder.component.html',
  styleUrls: ['./route-builder.component.scss']
})
export class RouteBuilderComponent implements OnInit {
  @Output() loadNewQuery: EventEmitter<number>;

  routeBuilderContainerClass: string;

  routeBuilderOpen: boolean;

  queries: string[];

  constructor() {
    this.queries = [
      '3-hydroxyisobutyric Acid to pykF Using ChEBI',
      '3-hydroxyisobutyric Acid to pykF using BioCyc',
      'icd to rhsE',
      'SIRT5 to NFE2L2 Using Literature Data',
      'CTNNB1 to Diarrhea Using Literature Data',
      'Two pathways using BioCyc',
    ];

    this.routeBuilderContainerClass = 'route-builder-container-open';
    this.routeBuilderOpen = true;

    this.loadNewQuery = new EventEmitter<number>();
  }

  ngOnInit() {
  }

  toggleRouteBuilderOpen() {
    this.routeBuilderOpen = !this.routeBuilderOpen;
    this.routeBuilderContainerClass = this.routeBuilderOpen ? 'route-builder-container-open' : 'route-builder-container-closed';
  }

  requestQueryLoadFromParent(event: any) {
    this.loadNewQuery.emit(event.target.value);
  }
}
