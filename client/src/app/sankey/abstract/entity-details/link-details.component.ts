import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { BaseControllerService } from '../../services/base-controller.service';
import { TypeContext } from '../../interfaces';

@Component({template: ''})
export abstract class SankeyAbstractLinkDetailsComponent<Base extends TypeContext> extends SankeyEntityDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<Base>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView.common, route);
  }

  linkValueAccessors$ = this.common.linkValueAccessors$;
  linkValueAccessor$ = this.baseView.linkValueAccessor$;
}

