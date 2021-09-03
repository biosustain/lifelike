import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, } from '@angular/core';

import { isNullOrUndefined } from 'util';
import { Options } from 'vis-network';

import { annotationTypesMap } from 'app/shared/annotation-styles';

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

  legend = new Map<string, string[]>();

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
      data.currentValue.nodes.forEach((node) => {
        if (!isNullOrUndefined(node.databaseLabel)) {
          const style = annotationTypesMap.get(node.databaseLabel.toLowerCase());
          this.legend.set(node.databaseLabel, isNullOrUndefined(style) ? ['#000', '#000'] : [style.color, style.color]);
        }
      });
    }
  }
}
