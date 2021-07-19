import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, } from '@angular/core';
import { Options } from 'vis-network';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { networkEdgeSmoothers } from '../../shared/components/vis-js-network/vis-js-network.constants';

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
      }
    },
    nodes: {
      shape: 'dot'
    }
  };

  legend: Map<string, string[]>;

  @Input() data;

  ngOnChanges({data}: SimpleChanges) {
    if (data) {
      this.legend = data.currentValue.nodes.reduce((o, n) => {
        if (!o.has(n.databaseLabel) && typeof n.color === 'string') {
          o.set(n.databaseLabel, [n.color, n.color]);
        }
        return o;
      }, new Map([['source / target', ['transparent', 'black']]]));
    }
  }
}
