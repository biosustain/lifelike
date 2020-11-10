import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-shortest-path',
  templateUrl: './shortest-path.component.html',
  styleUrls: ['./shortest-path.component.scss']
})
export class ShortestPathComponent implements OnInit {

  nodes: any;
  edges: any;

  constructor() {
    // create an array with nodes
    this.nodes = [
      {
        id: 1,
        label: 'Node 1',
        // font: {
        //   color,
        // },
        // color: {
        //   background: '#FFFFFF',
        //   hover: {
        //     background: '#FFFFFF',
        //   },
        //   highlight: {
        //     background: '#FFFFFF',
        //   },
        // },
      },
      { id: 2, label: 'Node 2' },
      { id: 3, label: 'Node 3' },
      { id: 4, label: 'Node 4' },
      { id: 5, label: 'Node 5' },
    ];

    // create an array with edges
    this.edges = [
      { from: 1, to: 3 },
      { from: 1, to: 2 },
      { from: 2, to: 4 },
      { from: 2, to: 5 },
      { from: 3, to: 3 },
    ];
  }

  ngOnInit() {
  }

  loadNewQuery(query: number) {
    console.log(`Need to load new query: ${query}`);
  }
}
