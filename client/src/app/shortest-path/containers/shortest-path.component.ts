import { Component, OnInit } from '@angular/core';

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

  displayType: string;
  graphData: GraphData;

  constructor(
    public shortestPathService: ShortestPathService,
  ) {}

  ngOnInit() { }

  changeDisplayType(type: string) {
    this.displayType = type;
  }

  loadNewQuery(query: number) {
    this.graphData = null;
    this.shortestPathService.getShortestPathQueryResult(query).subscribe((result) => {
      this.graphData = {
        nodes: result.nodes,
        edges: result.edges,
      };
    });
  }
}
