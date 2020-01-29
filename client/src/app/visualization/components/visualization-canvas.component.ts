import {
    Component,
    Input,
    EventEmitter,
    OnInit,
    Output,
} from '@angular/core';
import { Neo4jGraphConfig } from '../../interfaces';
import { Network, DataSet } from 'vis-network';

@Component({
    selector: 'app-visualization-canvas',
    templateUrl: './visualization-canvas.component.html',
    styleUrls: ['./visualization-canvas.component.scss'],
})
export class VisualizationCanvasComponent implements OnInit {
    @Output() expandAndCollapseNodeId = new EventEmitter<{nodeId: number, edgeIds: Array<number>}>();


    @Input() nodes: DataSet<any, any>;
    @Input() edges: DataSet<any, any>;
    // Configuration for the graph view. See vis.js docs
    @Input() config: Neo4jGraphConfig;

    networkGraph: Network;

    constructor() {}

    ngOnInit() {
        const container = document.getElementById('network-viz');
        const data = {
            nodes: this.nodes,
            edges: this.edges,
        };
        this.networkGraph = new Network(container, data, this.config);
        this.visualizerSetupEventBinds();
    }

    /**
     * Contains all of the event handling features for the
     * network graph.
     */
    visualizerSetupEventBinds() {

        this.networkGraph.on('hoverNode', (params) => {
            // This produces an 'enlarge effect'
            const node = this.nodes.get(params.node);
            const updatedNode = {...node, size: this.config.nodes.size * 1.5};
            this.nodes.update(updatedNode);
        });

        this.networkGraph.on('blurNode', (params) => {
            // This produces a 'shrink effect'
            const node = this.nodes.get(params.node);
            const updateNode = {...node, size: this.config.nodes.size};
            this.nodes.update(updateNode);
        });

        this.networkGraph.on('stabilizationIterationsDone', () => {
            // Disables the 'physics' engine after initial
            // physics calculations.
            this.networkGraph.setOptions({physics: false});
        });

        this.networkGraph.on('doubleClick', (params) => {
            const nodeId = params.nodes[0];
            const edgeIds = params.edges;
            // Check if event is double clicking a node
            if (nodeId) {
                this.expandAndCollapseNodeId.emit({ nodeId, edgeIds });
            }
        });
    }
}
