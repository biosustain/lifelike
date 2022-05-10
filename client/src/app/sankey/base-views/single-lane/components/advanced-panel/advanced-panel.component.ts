import { Component, OnDestroy, OnInit, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel.component';


import { SingleLaneBaseControllerService } from '../../services/single-lane-base-controller.service';
import { BaseState, BaseOptions } from '../../interfaces';

@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeySingleLaneAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<BaseOptions, BaseState>
  implements OnInit, OnDestroy {

  constructor(
    protected baseView: SingleLaneBaseControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
  }
  form = this.formBuilder.group({
    colorLinkByType: [false, []],
    highlightCircular: ['', []],
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
    linkValueAccessorId: [undefined, []],
    nodeValueAccessorId: [undefined, []],
  });

  colorLinkTypes$ = this.baseView.colorLinkTypes$;
  linkValueGenerators$ = this.baseView.common.linkValueGenerators$;
  linkValueAccessors$ = this.baseView.common.linkValueAccessors$;
  nodeValueGenerators$ = this.baseView.common.nodeValueGenerators$;
  nodeValueAccessors$ = this.baseView.common.nodeValueAccessors$;

  ngOnInit() {
    super.ngOnInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
