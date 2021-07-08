import { Component, Input, ViewEncapsulation, } from '@angular/core';
import { Options } from 'vis-network';

import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { getTraceDetailsGraph } from './traceDetails';
import { networkEdgeSmoothers } from '../../../shared/components/vis-js-network/vis-js-network.constants';

@Component({
  selector: 'app-trace-details',
  templateUrl: './trace-details.component.html',
  styleUrls: ['./trace-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TraceDetailsComponent {
  @Input() data;

  detailsData;

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
      }
    },
    nodes: {
      shape: 'dot'
    }
  };

  legend: Map<string, string[]>;

  @Input() set trace(trace) {
    if (!trace.detail_edges) {
      this.errorHandler.showError(new Error('No detail_edges defined therefore details view could not be rendered.'));
      this.detailsData = {
        nodes: [],
        edges: []
      };
    } else {
      this.detailsData = getTraceDetailsGraph(trace, this.data);
      this.legend = this.detailsData.nodes.reduce((o, n) => {
        if (!o.has(n.type) && typeof n.color === 'string') {
          o.set(n.type, [n.color, n.color]);
        }
        return o;
      }, new Map([['source / target', ['transparent', 'black']]]));
    }
  }

  constructor(protected readonly errorHandler: ErrorHandler) {
  }
}
