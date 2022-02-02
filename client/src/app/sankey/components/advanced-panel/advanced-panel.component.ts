import { Component, } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { combineLatest } from 'rxjs';
import { omit, forEach, reduce } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils';

import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';

@Component({
  selector: 'app-advanced-panel'
})
export class SankeyAdvancedPanelComponent {

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
  uuid: string;
  form: FormGroup;

  state: any;
  options: any;

  // @ts-ignore
  disableGroup(disabled, ...groups) {
    const controls = reduce(groups, (control, group) => control.get(group), this.form);
    const enabled = controls.get('enabled').value;
    const otherControlls = omit(
      (controls as FormGroup).controls,
      'enabled'
    );
    forEach(otherControlls, value => enabled ? value.enable() : value.disable());
  }
}
