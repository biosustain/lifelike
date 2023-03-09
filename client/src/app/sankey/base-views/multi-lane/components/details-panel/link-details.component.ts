import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { SankeyAbstractLinkDetailsComponent } from "../../../../abstract/entity-details/link-details.component";
import { BaseControllerService } from "../../../../services/base-controller.service";
import { Base } from "../../interfaces";
import { SankeyTraceLink } from "../../../../model/sankey-document";

@Component({
  selector: "app-sankey-multi-lane-link-details",
  templateUrl: "./link-details.component.html",
})
export class SankeyMultiLaneLinkDetailsComponent extends SankeyAbstractLinkDetailsComponent<Base> {
  entity: SankeyTraceLink;

  constructor(
    protected baseView: BaseControllerService<Base>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView, route);
  }
}

