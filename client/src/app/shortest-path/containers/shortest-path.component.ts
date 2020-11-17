import { Component, OnInit } from '@angular/core';

import { combineLatest, Subscription } from 'rxjs';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { ShortestPathService } from '../services/shortest-path.service';

export interface GraphData {
  nodes: any;
  edges: any;
}

@Component({
  selector: 'app-shortest-path',
  templateUrl: './shortest-path.component.html',
  styleUrls: ['./shortest-path.component.scss']
})
export class ShortestPathComponent implements OnInit {

  loadTask: BackgroundTask<[], any>;
  annotationsLoadedSub: Subscription;

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
    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({
      result: [shortestPathResult],
      value: [],
    }) => {
      this.graphData = {
        nodes: shortestPathResult.nodes,
        edges: shortestPathResult.edges,
      };
    });
  }

  ngOnInit() { }

  changeDisplayType(type: string) {
    this.displayType = type;
  }

  loadNewQuery(query: number) {
    this.graphData = null;
    this.loadedQuery = query;
    this.loadTask.update([]);
  }
}
