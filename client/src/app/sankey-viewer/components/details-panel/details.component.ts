import { Component, Input, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import * as CryptoJS from 'crypto-js';

import { parseForRendering } from '../utils';
import { SankeyControllerService } from '../../services/sankey-controller.service';
import { SankeyNode } from '../interfaces';


@Component({
  selector: 'app-sankey-details',
  template: ''
})
export class SankeyDetailsComponent {
  constructor(
    private sankeyController: SankeyControllerService,
    protected readonly route: ActivatedRoute
  ) {
  }

  @Input() entity;

  parseProperty = parseForRendering;

  openTraceView(trace) {
    const {project_name, file_id} = this.route.snapshot.params;
    const hash = CryptoJS.MD5(JSON.stringify({
      ...this.sankeyController.selectedNetworkTrace,
      traces: [],
      source: trace.source,
      target: trace.target
    })).toString();
    const url = `/projects/${project_name}/trace/${file_id}/${hash}`;

    window.open(url);
  }

  get options() {
    return this.sankeyController.options;
  }

  getNodeById(nodeId) {
    return (this.sankeyController.allData.nodes.find(({id}) => id === nodeId) || {}) as SankeyNode;
  }
}
