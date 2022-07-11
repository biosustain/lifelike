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
    return this.common.networkTraceIdx$.pipe(
      map(networkTraceIdx => {
        const {file_id} = this.route.snapshot.params;
        return window.open(`/files/${file_id}/trace/${networkTraceIdx}/${trace.id}`);
      })
    ).toPromise();
  }

  getNodeById(nodeId) {
    return this.common.data$.pipe(
      map(({nodeById}) => nodeById.get(nodeId) ?? {} as GraphNode)
    );
  }
}
