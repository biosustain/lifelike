import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SankeyControllerService } from 'app/sankey/services/sankey-controller.service';

import { SankeyAbstractAdvancedPanelComponent } from '../../abstract/advanced-panel/advanced-panel.component';
import { SankeyState, SankeyOptions } from '../../interfaces';

@Component({
  selector: 'app-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent extends SankeyAbstractAdvancedPanelComponent<SankeyOptions, SankeyState> implements OnDestroy {
  constructor(
    protected common: SankeyControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(common, formBuilder);
    this.onInit();
  }

  form = this.formBuilder.group({
    normalizeLinks: ['', []],
    fontSizeScale: [1, []],
    labelEllipsis: this.formBuilder.group({
      enabled: [false, []],
      value: [0, Validators.pattern(/^\d+$/)],
    }),
    prescalerId: [undefined, []],
  });

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
