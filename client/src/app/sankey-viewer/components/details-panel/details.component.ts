import { Component, Input, } from '@angular/core';
import { parseForRendering } from '../utils';
import { SankeyControllerService } from '../../services/sankey-controller.service';
import * as CryptoJS from 'crypto-js';
import { ActivatedRoute } from '@angular/router';


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

  gotoDynamic(trace) {
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

  getJSONDetails(details) {
    return JSON.stringify(details, (k, p) => this.parseProperty(p, k), 1);
  }

  getNodeById(nodeId) {
    return (this.sankeyController.sankeyData.nodes.find(({id}) => id === nodeId) || {}) as SankeyNode;
  }
}
