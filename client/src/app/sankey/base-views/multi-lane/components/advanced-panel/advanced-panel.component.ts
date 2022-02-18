import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel.component';

import { MultiLaneBaseControllerService } from '../../services/multi-lane-base-controller.service';
import { BaseOptions, BaseState } from '../../interfaces';
import { StateControlAbstractService } from '../../../../abstract/state-control.service';


@Component({
  selector: 'app-sankey-base-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class MultiLaneBaseAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<BaseOptions, BaseState>
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
    protected baseView: MultiLaneBaseControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
    this.onInit();
    this.baseView.common.viewName$.subscribe(viewName => {
      if (viewName) {
        this.form.get('nodeHeight').disable();
        this.form.get('linkValueAccessorId').disable();
        this.form.get('nodeValueAccessorId').disable();
      } else {
        this.form.get('nodeHeight').enable();
        this.form.get('linkValueAccessorId').enable();
        this.form.get('nodeValueAccessorId').enable();
      }
    });
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
