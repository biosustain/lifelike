import { Component, OnInit } from '@angular/core';
import { DataSet, Network } from 'vis-network';
import { VisualizationService } from '../visualization.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    networkGraph: Network;
    nodes: DataSet<any, any>;
    edges: DataSet<any, any>;

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        this.visService.query('').subscribe((result: {nodes: any[], edges: any[]}) => {
            this.nodes = new DataSet(result.nodes);
            this.edges = new DataSet(result.edges);

            // create a network
            let container = document.getElementById('network-viz');

            // provide the data in the vis format
            let data = {
                nodes: this.nodes,
                edges: this.edges,
            };

            let options = {
                // This will disable the bouncing
                physics: {
                    enabled: true,
                }
            };

            // initialize network
            let network = new Network(container, data, options);
            this.networkGraph = network
        });
    }
}
