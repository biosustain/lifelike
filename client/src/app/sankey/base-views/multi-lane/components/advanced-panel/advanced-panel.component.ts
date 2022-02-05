import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { BaseViewControllerService } from '../../../../services/sankey-base-view-controller.service';
import { SankeyAbstractAdvancedPanelComponent } from '../../../../abstract/advanced-panel.component';
import { SankeyMultiLaneOptions, SankeyMultiLaneState } from '../../interfaces';
import { ControllerService } from '../../services/controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyMultiLaneAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<SankeyMultiLaneOptions, SankeyMultiLaneState>
  implements OnDestroy {
  form = this.formBuilder.group({
    nodeHeight: this.formBuilder.group({
      min: this.formBuilder.group({
        enabled: [false, []],
        value: [0, []],
      }),
      max: this.formBuilder.group({
        enabled: [false, []],
        ratio: [{
          value: 0,
          disabled: true
        }, []],
      }),
    }),
    linkPaletteId: [undefined, []],
    linkValueAccessorId: [undefined, []],
    nodeValueAccessorId: [undefined, []],
  });

  constructor(
    protected baseView: ControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
    this.onInit();
  }

  linkPalettes$ = this.baseView.linkPalettes$;
  linkValueGenerators$ = this.baseView.common.linkValueGenerators$;
  linkValueAccessors$ = this.baseView.common.linkValueAccessors$;
  nodeValueGenerators$ = this.baseView.common.nodeValueGenerators$;
  nodeValueAccessors$ = this.baseView.common.nodeValueAccessors$;

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
