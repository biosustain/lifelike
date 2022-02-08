import { Component, OnDestroy, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { SankeyAbstractAdvancedPanelComponent } from 'app/sankey/abstract/advanced-panel.component';

import { SankeyMultiLaneOptions, SankeyMultiLaneState } from '../../interfaces';
import { MultiLaneBaseControllerService } from '../../services/multi-lane-base-controller.service';
import { tap } from 'rxjs/operators';


@Component({
  selector: 'app-sankey-base-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class MultiLaneBaseAdvancedPanelComponent
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
    protected baseView: MultiLaneBaseControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(baseView, formBuilder);
    this.onInit();
  }

  linkPalettes$ = this.baseView.linkPalettes$;
  linkValueGenerators$ = this.baseView.common.linkValueGenerators$;
  linkValueAccessors$ = this.baseView.common.linkValueAccessors$;
  nodeValueGenerators$ = this.baseView.common.nodeValueGenerators$.pipe(
    tap(d => console.log(d))
  );
  nodeValueAccessors$ = this.baseView.common.nodeValueAccessors$;

  ngOnDestroy() {
    super.ngOnDestroy();
  }
}
