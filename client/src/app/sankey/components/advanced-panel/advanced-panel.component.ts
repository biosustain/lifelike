import { Component, OnDestroy, OnInit, } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

import { ControllerService } from 'app/sankey/services/controller.service';

import { SankeyAbstractAdvancedPanelComponent } from '../../abstract/advanced-panel.component';
import { SankeyState, SankeyOptions } from '../../interfaces';

@Component({
  selector: 'app-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<SankeyOptions, SankeyState>
  implements OnInit, OnDestroy {
  constructor(
    protected common: ControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(common, formBuilder);
  }

  form = this.formBuilder.group({
    alignId: [undefined, []],
    normalizeLinks: ['', []],
    fontSizeScale: [1, []],
    labelEllipsis: this.formBuilder.group({
      enabled: [false, []],
      value: [0, Validators.pattern(/^\d+$/)],
    }),
    prescalerId: [undefined, []],
  });

  prescalers$ = this.common.prescalers$;
  aligns$ = this.common.aligns$;

  ngOnInit() {
    super.ngOnInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
