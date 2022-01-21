import { Component, } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { combineLatest } from 'rxjs';
import { pairwise, map } from 'rxjs/operators';
import { difference } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils';

import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';

@Component({
  selector: 'app-advanced-panel'
})
export class SankeyAdvancedPanelComponent {
  uuid: string;
  form: FormGroup;

  constructor(
    protected sankeyController: SankeyBaseViewControllerService,
    protected formBuilder: FormBuilder
  ) {
    this.uuid = uuidv4();

    combineLatest([
      this.sankeyController.state$,
      this.sankeyController.options$,
    ]).subscribe(([state, options]) => {
      this.options = options;
      this.state = state;
    });
  }

  state: any;
  options: any;
}
