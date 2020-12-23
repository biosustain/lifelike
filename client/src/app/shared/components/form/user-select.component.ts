import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChoiceListRequest, SelectInputComponent } from './select-input.component';
import { AppUser } from '../../../interfaces';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { EMPTY, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { debounce, debounceTime, map, switchMap, tap } from 'rxjs/operators';
import { AccountsService } from '../../services/accounts.service';
import { ErrorHandler } from '../../services/error-handler.service';

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
  requestLoading: ChoiceListRequest;
  protected subscriptions = new Subscription();

  constructor(protected readonly accountsService: AccountsService,
              protected readonly errorHandler: ErrorHandler) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.queries$.pipe(
      tap(request => this.requestLoading = request),
      debounce(request => request.query.trim().length ? timer(250) : EMPTY),
      switchMap((request): Observable<[ChoiceListRequest, readonly AppUser[]]> => {
        if (request.query.trim().length > 0) {
          return this.accountsService.search({
            query: request.query,
          }).pipe(
            map(list => [request, list.results.items]),
          );
        } else {
          return of([request, []]);
        }
      }),
      tap(([request, items]) => {
        if (this.requestLoading === request) {
          this.requestLoading = null;
        }
      }),
      this.errorHandler.create(),
    ).subscribe(([request, items]) => this.choices = items));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get loading(): boolean {
    return this.requestLoading != null;
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
