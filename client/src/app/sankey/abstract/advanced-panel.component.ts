import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";

import { forEach, isEmpty, omit } from "lodash-es";
import { filter, map, pairwise, startWith, switchMap, tap } from "rxjs/operators";
import { Subscription } from "rxjs";

import { deepDiff, uuidv4 } from "app/shared/utils";
import { debug } from "app/shared/rxjs/debug";

import { StateControlAbstractService } from "./state-control.service";

export type DefaultAbstractAdvancedPanelComponent = SankeyAbstractAdvancedPanelComponent<
  object,
  object
>;

@Component({ template: "" })
export abstract class SankeyAbstractAdvancedPanelComponent<
  Options extends object,
  State extends object
> implements OnInit, OnDestroy
{
  uuid: string = uuidv4();
  options$ = this.stateController.options$;
  form: FormGroup;
  formToStateSubscribtion: Subscription;
  formStateSync$ = this.stateController.state$.pipe(
    tap((state) => this.form.patchValue(state, { emitEvent: false })),
    map(() => this.form.value as Partial<State>),
    debug("formStateSync$"),
    switchMap((prevValue) =>
      this.form.valueChanges.pipe(
        debug("form.valueChanges"),
        startWith(prevValue), // initial prev value
        pairwise(),
        map(deepDiff),
        filter((changes) => !isEmpty(changes)),
        switchMap((changes) => this.stateController.patchState(changes as any))
      )
    )
  );

  constructor(
    protected stateController: StateControlAbstractService<Options, State>,
    protected formBuilder: FormBuilder
  ) {}

  ngOnInit() {
    // make the connection hot
    this.formToStateSubscribtion = this.formStateSync$.subscribe();
  }

  ngOnDestroy() {
    if (this.formToStateSubscribtion) {
      this.formToStateSubscribtion.unsubscribe();
    }
  }

  disableGroup(disabled, groups, enabledKey = "enabled") {
    const controls = this.form.get(groups);
    const enabled = controls.get(enabledKey).value;
    const otherControlls = omit((controls as FormGroup).controls, enabledKey);
    forEach(otherControlls, (value) => (enabled ? value.enable() : value.disable()));
  }
}
