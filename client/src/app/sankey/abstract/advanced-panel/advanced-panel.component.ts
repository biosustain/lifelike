import { OnDestroy, } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { omit, forEach, isEmpty } from 'lodash-es';
import { startWith, pairwise, map, filter, switchMap, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import { uuidv4, deepDiff } from 'app/shared/utils';

import { StateControlAbstractService } from '../../services/state-controlling-abstract.service';

export class SankeyAbstractAdvancedPanelComponent<Options extends object, State extends object> implements OnDestroy {

  constructor(
    protected stateController: StateControlAbstractService<Options, State>,
    protected formBuilder: FormBuilder
  ) {
  }

  uuid: string = uuidv4();
  options$ = this.stateController.options$;
  form: FormGroup;
  formToStateSubscribtion: Subscription;

  onInit() {
    this.formToStateSubscribtion = this.connectFormToStateController(this.form, this.stateController);
  }

  ngOnDestroy() {
    if (this.formToStateSubscribtion) {
      this.formToStateSubscribtion.unsubscribe();
    }
  }

  // as function so can be called after init of inheriting class
  connectFormToStateController(form, stateController) {
    return stateController.state$.pipe(
      tap(state => form.patchValue(state, {emitEvent: false})),
      map(() => form.value),
      switchMap(prevValue => form.valueChanges.pipe(
        startWith(prevValue), // initial prev value
        pairwise(),
        map(deepDiff),
        filter(changes => !isEmpty(changes)),
        switchMap(changes => stateController.patchState(changes as any))
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
