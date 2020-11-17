import { Component, EventEmitter, OnInit, Output } from '@angular/core';

import { combineLatest, Subscription } from 'rxjs';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

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

  loadShortestPathQueries: BackgroundTask<[], any>;
  queriesLoadedsub: Subscription;

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

    this.loadShortestPathQueries = new BackgroundTask(() => {
      return combineLatest(
        this.shortestPathService.getShortestPathQueryList(),
      );
    });
    this.queriesLoadedsub = this.loadShortestPathQueries.results$.subscribe(({
      result: [shortestPathQueries],
      value: [],
    }) => {
      this.queries = shortestPathQueries;
    });
  }

  ngOnInit() {
    this.loadNewQuery.emit(0);
    this.changeDisplayType.emit('NETWORK');
    this.loadShortestPathQueries.update([]);
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
