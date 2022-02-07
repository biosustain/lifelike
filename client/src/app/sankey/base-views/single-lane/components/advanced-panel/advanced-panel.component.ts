import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel.component';

import { SankeySingleLaneState, SankeySingleLaneOptions } from '../interfaces';
import { SingleLaneBaseControllerService } from '../../services/single-lane-base-controller.service';

@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeySingleLaneAdvancedPanelComponent
  extends SankeyAbstractAdvancedPanelComponent<SankeySingleLaneOptions, SankeySingleLaneState>
  implements OnDestroy {
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

  constructor(
    protected baseView: SingleLaneBaseControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
    this.onInit();
  }

  colorLinkTypes$ = this.baseView.colorLinkTypes$;
  linkValueGenerators$ = this.baseView.common.linkValueGenerators$;
  linkValueAccessors$ = this.baseView.common.linkValueAccessors$;
  nodeValueGenerators$ = this.baseView.common.nodeValueGenerators$;
  nodeValueAccessors$ = this.baseView.common.nodeValueAccessors$;

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
