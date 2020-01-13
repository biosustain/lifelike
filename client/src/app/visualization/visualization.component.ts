import { Component, OnInit } from '@angular/core';
import { DataSet, Edge, Network } from 'vis-network';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
})
export class VisualizationComponent implements OnInit {
    constructor() {}

    ngOnInit() {
        // create an array of nodes
        let nodes = new DataSet([
            {id: 1, label: 'Node 1'},
            {id: 2, label: 'Node 2'},
            {id: 3, label: 'Node 3'},
            {id: 4, label: 'Node 4'},
            {id: 5, label: 'Node 5'}
        ]);

        // create an array with edges
        let edges: Edge[] = [
            {from: 1, to: 3},
            {from: 1, to: 2},
            {from: 2, to: 4},
            {from: 2, to: 5}
        ];

        // create a network
        let container = document.getElementById('network-viz');

        // provide the data in the vis format
        let data = {
            nodes: nodes,
            edges: edges,
        };

        let options = {};

        // initialize network
        let network = new Network(container, data, options);
    }
}
