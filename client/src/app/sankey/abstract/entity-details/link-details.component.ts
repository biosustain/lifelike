import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { BaseControllerService } from '../../services/base-controller.service';
import { SankeyBaseOptions, SankeyBaseState } from '../../base-views/interfaces';

@Component({template: ''})
export abstract class SankeyAbstractLinkDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<SankeyBaseOptions, SankeyBaseState>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView.common, route);
  }

  linkValueAccessors$ = this.common.linkValueAccessors$;
  linkValueAccessor$ = this.baseView.linkValueAccessor$;
}

