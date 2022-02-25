import { OnDestroy, OnInit, } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { omit, forEach, isEmpty } from 'lodash-es';
import { startWith, pairwise, map, filter, switchMap, tap, publish } from 'rxjs/operators';
import { Subscription, ConnectableObservable } from 'rxjs';

import { uuidv4, deepDiff } from 'app/shared/utils';

import { StateControlAbstractService } from './state-control.service';


export type DefaultAbstractAdvancedPanelComponent = SankeyAbstractAdvancedPanelComponent<object, object>;

export class SankeyAbstractAdvancedPanelComponent<Options extends object, State extends object> implements OnInit, OnDestroy {
  constructor(
    protected stateController: StateControlAbstractService<Options, State>,
    protected formBuilder: FormBuilder
  ) {
  }
  uuid: string = uuidv4();
  options$ = this.stateController.options$;
  form: FormGroup;
  formToStateSubscribtion: Subscription;
  formStateSync$ = this.stateController.state$.pipe(
    tap(state => this.form.patchValue(state, {emitEvent: false})),
    map(() => this.form.value),
    switchMap(prevValue => this.form.valueChanges.pipe(
      startWith(prevValue), // initial prev value
      pairwise(),
      map(deepDiff),
      filter(changes => !isEmpty(changes)),
      switchMap(changes => this.stateController.patchState(changes as any))
    ))
  );

  ngOnInit() {
    // make the connection hot
    this.formToStateSubscribtion = this.formStateSync$.subscribe();
  }

  ngOnDestroy() {
    if (this.formToStateSubscribtion) {
      this.formToStateSubscribtion.unsubscribe();
    }
  }

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
