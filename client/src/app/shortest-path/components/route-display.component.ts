import { Component, Input } from '@angular/core';

import { DataSet } from 'vis-network';

import { Neo4jGraphConfig } from 'app/interfaces';

import { GraphData } from '../containers/shortest-path.component';

export enum DisplayType {
  NETWORK = 'network',
  SANKEY = 'sankey'
}

@Component({
  selector: 'app-route-display',
  templateUrl: './route-display.component.html',
  styleUrls: ['./route-display.component.scss']
})
export class RouteDisplayComponent {
  @Input() set displayType(displayType: DisplayType) {
    this.currentDisplay = DisplayType[displayType];
  }
  @Input() set graphData(graphData: GraphData) {
    // Update vis js data
    this.networkData.nodes = graphData.nodes;
    this.networkData.edges = graphData.edges;

    // Update sankey data
    this.generateSankeyData(graphData.nodes, graphData.edges);
  }

  currentDisplay: string;

  networkConfig: Neo4jGraphConfig;
  networkData: any;

  sankeyConfig: any;
  sankeyData: any;

  constructor() {
    this.initVisJsSettings();
    this.initPlotlySankeySettings();
  }

  initVisJsSettings() {
    // Init vis js network settings
    this.networkConfig = {
      interaction: {
        hover: true,
        navigationButtons: true,
        multiselect: true,
        selectConnectedEdges: false,
      },
      physics: {
        enabled: true,
        barnesHut: {
          avoidOverlap: 0.2,
          centralGravity: 0.1,
          damping: 0.9,
          gravitationalConstant: -10000,
          springLength: 250,
        },
      },
      edges: {
        font: {
          size: 12,
        },
        widthConstraint: {
          maximum: 90,
        },
      },
      nodes: {
        size: 25,
        shape: 'box',
        // TODO: Investigate the 'scaling' property for dynamic resizing of 'box' shape nodes
      },
    };

    this.networkData = {
      nodes: new DataSet(),
      edges: new DataSet(),
    };
  }

  generateSankeyData(nodes: any[], edges: any[]) {
    const source = [];
    const target = [];
    const value = [];
    const label = [];
    const color = [];

    const nodeIdentityMap = new Map<number, number>();
    nodes.forEach((node, i) => {
      nodeIdentityMap.set(node.id, i);
      label.push(node.label);
      color.push(node.color.border);
      value.push(0);
    });

    const sankeyEdgeSet = new Set<number[]>();
    edges.forEach(edge => {
      const sankeyEdge = [nodeIdentityMap.get(edge.from), nodeIdentityMap.get(edge.to)];
      if (sankeyEdgeSet.has(sankeyEdge)) {
        value[sankeyEdge[0]] += 1;
        value[sankeyEdge[1]] += 1;
      } else {
        sankeyEdgeSet.add(sankeyEdge);
        source.push(sankeyEdge[0]);
        target.push(sankeyEdge[1]);
        value[sankeyEdge[0]] += 1;
        value[sankeyEdge[1]] += 1;
      }
    });

    this.sankeyData = {
      type: 'sankey',
      orientation: 'h',
      node: {
        arrangement: 'snap',
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label,
        color,
      },

      link: {
        source,
        target,
        value
      }
    };
  }

  initPlotlySankeySettings() {
    // Init plotly sankey settings
    this.sankeyData = {
      type: 'sankey',
      orientation: 'h',
      node: {
        arrangement: 'snap',
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label: [],
        color: [],
      },

      link: {
        source: [],
        target: [],
        value: []
      }
    };

    this.sankeyConfig = {
      title: 'Sankey Diagram of Query Results',
      font: {
        size: 10
      }
    };
  }
}
