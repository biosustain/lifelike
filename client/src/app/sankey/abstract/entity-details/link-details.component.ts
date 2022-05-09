import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Base } from 'app/sankey/base-views/single-lane/interfaces';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { BaseControllerService } from '../../services/base-controller.service';

@Component({template: ''})
export abstract class SankeyAbstractLinkDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<Base>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView.common, route);
  }

  linkValueAccessors$ = this.common.linkValueAccessors$;
  linkValueAccessor$ = this.baseView.linkValueAccessor$;
}

