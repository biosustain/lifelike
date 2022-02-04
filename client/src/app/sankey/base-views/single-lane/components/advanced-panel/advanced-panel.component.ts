import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel/advanced-panel.component';
import { SankeyBaseViewControllerService } from '../../../../services/sankey-base-view-controller.service';
import { SankeySingleLaneState, SankeySingleLaneOptions } from '../interfaces';

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
    protected baseView: SankeyBaseViewControllerService<SankeySingleLaneOptions, SankeySingleLaneState>,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
    this.onInit();
  }

  commonOptions$ = this.baseView.common.options$;

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
