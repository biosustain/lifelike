import { Component, } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { pairwise, map, filter, startWith } from 'rxjs/operators';
import { size, isEmpty } from 'lodash-es';

import { uuidv4, deepDiff } from 'app/shared/utils';

import { SankeyAdvancedPanelComponent } from '../../../../components/advanced-panel/advanced-panel.component';
import { SankeyBaseViewControllerService } from '../../../../services/sankey-base-view-controller.service';

@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeySingleLaneAdvancedPanelComponent extends SankeyAdvancedPanelComponent {
  form = this.formBuilder.group({
    colorLinkByType: [false, []],
    highlightCircular: ['', []],
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
  });

  constructor(
    protected sankeyController: SankeyBaseViewControllerService,
    protected formBuilder: FormBuilder
  ) {
    super(sankeyController, formBuilder);
    this.connectFormToState();
  }
}
