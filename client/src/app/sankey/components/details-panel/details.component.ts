import { Component, Input, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import * as CryptoJS from 'crypto-js';
import { map } from 'rxjs/operators';

import { SankeyNode } from 'app/sankey/interfaces';

import { parseForRendering } from '../../utils';
import { SankeyControllerService } from '../../services/sankey-controller.service';


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
    return this.sankeyController.networkTrace$.pipe(
      map(networkTrace => {
        const {project_name, file_id} = this.route.snapshot.params;
        const hash = CryptoJS.MD5(JSON.stringify({
          ...networkTrace,
          traces: [],
          source: trace.source,
          target: trace.target
        })).toString();
        const url = `/projects/${project_name}/trace/${file_id}/${hash}`;
        window.open(url);
        return url;
      })
    ).toPromise();
  }

  getNodeById(nodeId) {
    return this.sankeyController.data$.pipe(
      map(({nodes}) => nodes.find(({id}) => id === nodeId) ?? {} as SankeyNode)
    );
  }
}
