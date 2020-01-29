import { Component, OnInit, Input } from '@angular/core';
import { Neo4jResults } from '../../interfaces';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
})
export class VisualizationCanvasComponent implements OnInit {
    @Input() data: Neo4jResults;
    @Input() config: object;

    networkGraph: Network;
    nodes: DataSet<any, any>;
    edges: DataSet<any, any>;

    constructor() {}

    ngOnInit() {
        if (this.data) {
            this.initializeVisualizer();
        }
    }

    initializeVisualizer() {
        const container = document.getElementById('network-viz');
        const { nodes, edges } = this.data;
        this.networkGraph = new Network(container, {nodes, edges}, this.config);
    }
}
