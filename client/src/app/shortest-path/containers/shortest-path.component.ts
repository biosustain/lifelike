import { Component, OnDestroy } from '@angular/core';

import { combineLatest, Subscription } from 'rxjs';

import { Edge, Node } from 'vis-network';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { ShortestPathService } from '../services/shortest-path.service';

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

@Component({
  selector: 'app-shortest-path',
  templateUrl: './shortest-path.component.html',
  styleUrls: ['./shortest-path.component.scss']
})
export class ShortestPathComponent implements OnDestroy {

  loadTask: BackgroundTask<[], any>;
  shortestPathLoadedSub: Subscription;

  loadedQuery: number;
  displayType: string;
  graphData: GraphData;

  constructor(
    public shortestPathService: ShortestPathService,
  ) {
    this.loadTask = new BackgroundTask(() => {
      return combineLatest(
        this.shortestPathService.getShortestPathQueryResult(this.loadedQuery),
      );
    });
    this.shortestPathLoadedSub = this.loadTask.results$.subscribe(({
      result: [shortestPathResult],
      value: [],
    }) => {
      this.graphData = {
        nodes: shortestPathResult.nodes,
        edges: shortestPathResult.edges,
      };
    });
  }

  ngOnDestroy() {
    this.shortestPathLoadedSub.unsubscribe();
  }

  changeDisplayType(type: string) {
    this.displayType = type;
  }

  loadNewQuery(query: number) {
    this.graphData = null;
    this.loadedQuery = query;
    this.loadTask.update([]);
  }
}
