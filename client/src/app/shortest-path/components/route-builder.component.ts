import { Component, EventEmitter, OnInit, Output } from '@angular/core';

import { ShortestPathService } from '../services/shortest-path.service';

import { DisplayType } from './route-display.component';

@Component({
  selector: 'app-route-builder',
  templateUrl: './route-builder.component.html',
  styleUrls: ['./route-builder.component.scss']
})
export class RouteBuilderComponent implements OnInit {
  @Output() loadNewQuery: EventEmitter<number>;
  @Output() changeDisplayType: EventEmitter<string>;

  routeBuilderContainerClass: string;

  routeBuilderOpen: boolean;

  queries: Map<number, string>;

  constructor(
    public shortestPathService: ShortestPathService,
  ) {
    this.queries = new Map<number, string>();

    this.routeBuilderContainerClass = 'route-builder-container-open';
    this.routeBuilderOpen = true;

    this.loadNewQuery = new EventEmitter<number>();
    this.changeDisplayType = new EventEmitter<DisplayType>();
  }

  ngOnInit() {
    this.loadNewQuery.emit(0);
    this.changeDisplayType.emit('NETWORK');

    this.shortestPathService.getShortestPathQueryList().subscribe(queryMap => {
      this.queries = queryMap;
    });
  }

  toggleRouteBuilderOpen() {
    this.routeBuilderOpen = !this.routeBuilderOpen;
    this.routeBuilderContainerClass = this.routeBuilderOpen ? 'route-builder-container-open' : 'route-builder-container-closed';
  }

  requestQueryLoadFromParent(event: any) {
    this.loadNewQuery.emit(Number.parseInt(event.target.value, 10));
  }

  requestChangeDisplayTypeFromParent(type: string) {
    this.changeDisplayType.emit(type);
  }
}
