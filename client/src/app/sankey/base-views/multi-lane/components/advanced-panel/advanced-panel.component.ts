import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel.component';

import { MultiLaneBaseControllerService } from '../../services/multi-lane-base-controller.service';
import { BaseOptions, BaseState } from '../../interfaces';

@Component({
  selector: 'app-sankey-base-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class MultiLaneBaseAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<BaseOptions, BaseState>
  implements OnInit, OnDestroy
{
  constructor(
    protected baseView: MultiLaneBaseControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
  }

  form = this.formBuilder.group({
    nodeHeight: this.formBuilder.group({
      min: this.formBuilder.group({
        enabled: [false, []],
        value: [0, []],
      }),
      max: this.formBuilder.group({
        enabled: [false, []],
        ratio: [
          {
            value: 0,
            disabled: true,
          },
          [],
        ],
      }),
    }),
    linkPaletteId: [undefined, []],
    linkValueAccessorId: [undefined, []],
    nodeValueAccessorId: [undefined, []],
  });

  readonly linkPalettes$ = this.baseView.linkPalettes$;
  readonly linkValueGenerators$ = this.baseView.common.linkValueGenerators$;
  readonly linkValueAccessors$ = this.baseView.common.linkValueAccessors$;
  readonly nodeValueGenerators$ = this.baseView.common.nodeValueGenerators$;
  readonly nodeValueAccessors$ = this.baseView.common.nodeValueAccessors$;

  ngOnInit() {
    super.ngOnInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
