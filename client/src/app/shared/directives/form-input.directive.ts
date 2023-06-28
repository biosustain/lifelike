import { Directive, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { combineLatest, defer, iif, of, ReplaySubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap, takeUntil } from 'rxjs/operators';

/**
 * Implements shared properties of an input.
 */
@Directive({
  selector: '[appFormInput]',
})
export class FormInputDirective implements OnChanges, OnDestroy {
  private destroy$ = new Subject();
  @Input() appFormInput: AbstractControl;
  @Input() pristineInvalid: boolean; // If true, invalid state is also shown if the control is pristine
  private appFormInputChange$ = new ReplaySubject<AbstractControl>(1);
  private appFormInput$ = this.appFormInputChange$.pipe(
    startWith(this.appFormInput),
    distinctUntilChanged()
    // takeUntil(this.destroy$),
    // shareReplay({bufferSize: 1, refCount: true}),
  );
  private pristineInvalidChange$ = new ReplaySubject<boolean>(1);
  private pristineInvalid$ = this.pristineInvalidChange$.pipe(
    startWith(this.pristineInvalid),
    distinctUntilChanged()
    // takeUntil(this.destroy$),
    // shareReplay({bufferSize: 1, refCount: true}),
  );
  private status$ = this.appFormInput$.pipe(
    switchMap((control: AbstractControl) =>
      iif(
        () => Boolean(control),
        defer(() => control.statusChanges.pipe(startWith(control.status))),
        of(null)
      )
    ),
    distinctUntilChanged()
    // takeUntil(this.destroy$),
    // shareReplay({bufferSize: 1, refCount: true}),
  );
  @HostBinding('class.is-invalid') invalid = false;
  @HostBinding('class.form-control') formControl = true;

  constructor() {
    combineLatest([this.status$, this.pristineInvalid$])
      .pipe(
        map(
          ([status, pristineInvalid]) =>
            status === 'INVALID' && (pristineInvalid || !this.appFormInput.pristine)
        ),
        takeUntil(this.destroy$)
        // shareReplay({bufferSize: 1, refCount: true}),
      )
      .subscribe((invalid) => {
        this.invalid = invalid;
      });
  }

  ngOnChanges({ appFormInput, pristineInvalid }: SimpleChanges) {
    if (appFormInput) {
      this.appFormInputChange$.next(appFormInput.currentValue);
    }
    if (pristineInvalid) {
      this.pristineInvalidChange$.next(pristineInvalid.currentValue);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
