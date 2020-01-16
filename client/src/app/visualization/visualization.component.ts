import { Component, OnInit } from '@angular/core';
import { DataSet, Edge, Network } from 'vis-network';
import { VisualizationService } from './visualization.service';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.sass'],
})
export class VisualizationComponent implements OnInit {

    networkGraph: Network;
    nodes: DataSet<any, any>;
    edges: DataSet<any, any>;

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        // #TODO: Notice need to COALESCE the origin node or no connection
        // # TODO: Remove me, don't allow users to perform cypher queries
        const exampleQuery = 'MATCH paths=((person {name: "Tyrion-Lannister"})-[relationship:INTERACTS]->(node:Character)) RETURN paths, relationship, node'; /* tslint:disable */
        this.visService.query(exampleQuery).subscribe((result: {nodes: any[], edges: any[]}) => {
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
