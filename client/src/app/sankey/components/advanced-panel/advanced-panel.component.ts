import { Component, } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { omit, forEach, isEmpty } from 'lodash-es';

import { uuidv4, deepDiff } from 'app/shared/utils';

import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';
import { startWith, pairwise, map, filter, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-advanced-panel'
})
export class SankeyAdvancedPanelComponent {
  constructor(
    protected sankeyController: SankeyBaseViewControllerService,
    protected formBuilder: FormBuilder
  ) {
    this.uuid = uuidv4();
  }

  options$ = this.sankeyController.options$;

  uuid: string;
  form: FormGroup;

  // as function so can be called after init of inheriting class
  connectFormToState() {
    this.sankeyController.state$.pipe(
      tap(state => this.form.patchValue(state, {emitEvent: false})),
      switchMap(state => this.form.valueChanges.pipe(
        startWith(state), // initial prev value
        pairwise(),
        map(deepDiff),
        filter(changes => !isEmpty(changes)),
        switchMap(changes => this.sankeyController.c.patchState(changes as any))
      ))
    )
      // comming in hot, no other components care about valueChanges
      .subscribe(stateDelta => console.log('stateDelta', stateDelta));
  }

  // @ts-ignore
  disableGroup(disabled, groups, enabledKey = 'enabled') {
    const controls = this.form.get(groups);
    const enabled = controls.get(enabledKey).value;
    const otherControlls = omit(
      (controls as FormGroup).controls,
      enabledKey
    );
    forEach(otherControlls, value => enabled ? value.enable() : value.disable());
  }
}
