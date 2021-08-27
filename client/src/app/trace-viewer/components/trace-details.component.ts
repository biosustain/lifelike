import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, } from '@angular/core';

import { Options } from 'vis-network';

import { networkEdgeSmoothers } from '../../shared/components/vis-js-network/vis-js-network.constants';
import { parseForRendering } from '../../sankey-viewer/components/utils';

@Component({
  selector: 'app-trace-details',
  templateUrl: './trace-details.component.html',
  styleUrls: ['./trace-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TraceDetailsComponent implements OnChanges {
  config: Options = {
    physics: {
      enabled: false,
      barnesHut: {
        avoidOverlap: 0.9,
        centralGravity: 0.001,
        damping: 0.6,
        gravitationalConstant: -10000,
        springLength: 250,
      },
      stabilization: {
        enabled: false
      }
    },
    edges: {
      smooth: {
        type: networkEdgeSmoothers.DYNAMIC, enabled: true, roundness: 0
      },
      font: {
        size: 30
      },
      // @ts-ignore
      chosen: {
        label: (values, id, selected, hovering) => {
          values.size = 35;
        }
      }
    },
    nodes: {
      shape: 'dot',
      font: {
        size: 40
      }
    },
    interaction: {
      hover: true
    }
  };

  legend: Map<string, string[]>;

  @Input() data;

  nodeHover(node) {
    Object.assign(node, {
      label: node.fullLabel
    });
  }

  nodeBlur(node) {
    Object.assign(node, {
      label: node.labelShort
    });
  }

  ngOnChanges({data}: SimpleChanges) {
    if (data.currentValue) {
      this.legend = data.currentValue.nodes.reduce((o, n) => {
        if (!o.has(n.databaseLabel) && typeof n.color === 'string') {
          o.set(n.databaseLabel, [n.color, n.color]);
        }
        return o;
      }, new Map([['source / target', ['transparent', 'black']]]));
    }
  }

  getJSONDetails(details) {
    return JSON.stringify(details, (k, p) => parseForRendering(p, k), 1);
  }
}
