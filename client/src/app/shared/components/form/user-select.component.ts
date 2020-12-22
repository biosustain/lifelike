import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChoiceListRequest, SelectInputComponent } from './select-input.component';
import { AppUser } from '../../../interfaces';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { of, Subject, Subscription } from 'rxjs';
import { filter, map, mergeMap, switchMap } from 'rxjs/operators';
import { AccountsService } from '../../services/accounts.service';
import { ErrorHandler } from '../../services/error-handler.service';
import { ModalList } from '../../models';

@Component({
  selector: 'app-user-select',
  templateUrl: './user-select.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: UserSelectComponent,
    multi: true,
  }],
})
export class UserSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {

  @Input() multiple = false;
  @Input() placeholder = '';
  @ViewChild('selectInput', {static: false, read: SelectInputComponent}) selectInputComponent;

  protected changeCallback: ((value: any) => any) | undefined;
  protected touchCallback: (() => any) | undefined;
  value: any;
  choices: readonly AppUser[] = [];
  queries$ = new Subject<ChoiceListRequest>();
  protected subscriptions = new Subscription();

  constructor(protected readonly accountsService: AccountsService,
              protected readonly errorHandler: ErrorHandler) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.queries$.pipe(
      switchMap(request => {
        if (request.query.trim().length > 0) {
          return this.accountsService.search({
            query: request.query,
          }).pipe(
            map(list => list.results.items)
          );
        } else {
          return of([]);
        }
      }),
      this.errorHandler.create(),
    ).subscribe(results => this.choices = results));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  processRequest(request: ChoiceListRequest) {
    this.queries$.next(request);
  }

  userChoiceToKey(choice: AppUser) {
    return choice != null ? choice.hashId : null;
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(obj: any): void {
    this.value = obj;
  }

  onModelChange(value) {
    if (this.changeCallback) {
      this.changeCallback(value);
    }
    if (this.touchCallback()) {
      this.touchCallback();
    }
  }
}
