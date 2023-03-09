import { Component, Input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs/operators";

import { GraphNode } from "app/shared/providers/graph-type/interfaces";

import { parseForRendering } from "../../utils";
import { ControllerService } from "../../services/controller.service";
import { DisplayPropertyType } from "../../interfaces";

@Component({ template: "" })
export abstract class SankeyEntityDetailsComponent {
  @Input() entity;
  parseProperty = parseForRendering;

  constructor(protected common: ControllerService, protected readonly route: ActivatedRoute) {}

  openTraceView(trace) {
    return this.common.networkTraceIdx$
      .pipe(
        map((networkTraceIdx) => {
          const { file_id } = this.route.snapshot.params;
          return window.open(`/files/${file_id}/trace/${networkTraceIdx}/${trace.id}`);
        })
      )
      .toPromise();
  }

  getNodeById(nodeId) {
    return this.common.data$.pipe(
      map(({ getNodeById }) => getNodeById(nodeId) ?? ({} as GraphNode))
    );
  }

  getLinks(displayProperties) {
    return displayProperties?.filter(({ type }) => type === DisplayPropertyType.URL);
  }
}
