import { Input, Component, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import * as CryptoJS from 'crypto-js';
import { map } from 'rxjs/operators';

import { GraphNode } from 'app/shared/providers/graph-type/interfaces';

import { parseForRendering } from '../../utils';
import { ControllerService } from '../../services/controller.service';

@Component({ template: '' })
export abstract class SankeyEntityDetailsComponent {
  constructor(
    protected common: ControllerService,
    protected readonly route: ActivatedRoute
  ) {
  }

  @Input() entity;

  parseProperty = parseForRendering;

  openTraceView(trace) {
    return this.common.networkTrace$.pipe(
      map(networkTrace => {
        const {project_name, file_id} = this.route.snapshot.params;
        const hash = CryptoJS.MD5(JSON.stringify({
          ...(networkTrace as object),
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
    return this.common.data$.pipe(
      map(({nodeById}) => nodeById.get(nodeId) ?? {} as GraphNode)
    );
  }
}
