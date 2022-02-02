import { Component, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { isEmpty } from 'lodash-es';
import { pairwise, map, filter, startWith } from 'rxjs/operators';

import { deepDiff } from 'app/shared/utils';

import { SankeyAdvancedPanelComponent } from '../../../../components/advanced-panel/advanced-panel.component';
import { SankeyBaseViewControllerService } from '../../../../services/sankey-base-view-controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyMultiLaneAdvancedPanelComponent extends SankeyAdvancedPanelComponent {
  form = this.formBuilder.group({
    normalizeLinks: ['', []],
    fontSizeScale: [1, []],
    nodeHeight: this.formBuilder.group({
      min: this.formBuilder.group({
        enabled: [false, []],
        value: [0, []],
      }),
      max: this.formBuilder.group({
        enabled: [false, []],
        ratio: [0, []],
      }),
    }),
    labelEllipsis: this.formBuilder.group({
      enabled: [false, []],
      value: [0, []],
    }),
    linkValueAccessorId: [undefined, []],
    nodeValueAccessorId: [undefined, []],
    prescalerId: [undefined, []],
    linkPaletteId: [undefined, []],
  });

  constructor(
    protected sankeyController: SankeyBaseViewControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(sankeyController, formBuilder);
    this.sankeyController.state$.subscribe(state => {
      this.form.patchValue(state);
    });
    this.form.valueChanges.pipe(
      startWith({}), // initial prev value
      pairwise(),
      map(deepDiff),
      filter(changes => !isEmpty(changes))
    ).subscribe(changes => {
      this.sankeyController.c.patchState(changes as any).toPromise();
    });
  }
}
