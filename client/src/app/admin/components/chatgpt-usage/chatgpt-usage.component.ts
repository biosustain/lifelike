import { Component } from '@angular/core';

import { BehaviorSubject, combineLatest, Observable, of, ReplaySubject } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { NgbInputDatepickerConfig, NgbTimepickerConfig } from '@ng-bootstrap/ng-bootstrap';
import { isNil as _isNil, omitBy as _omitBy } from 'lodash/fp';

import {
  DropdownController,
  dropdownControllerFactory,
} from 'app/shared/utils/dropdown.controller.factory';
import { AccountService } from 'app/users/services/account.service';

import { ChatGPTUsageInterval, ChatgptUsageService } from '../../services/chatgpt-usage.service';

export interface Period {
  // using timestamps for imuutability
  start: number; // Unix timestamp in seconds
  end?: number; // Unix timestamp in seconds
}

const dateToTimestampS = (date: Date | number) => Math.floor(+date / 1e3);

@Component({
  selector: 'app-chatgpt-usage',
  templateUrl: './chatgpt-usage.component.html',
  providers: [NgbInputDatepickerConfig, NgbTimepickerConfig],
})
export class ChatgptUsageComponent {
  constructor(
    private readonly chatgptUsageService: ChatgptUsageService,
    private readonly accountService: AccountService,
    private readonly timepickerConfig: NgbTimepickerConfig,
    private readonly datepickerConfig: NgbInputDatepickerConfig
  ) {
    // About the time we starteed to use ChatGPT
    datepickerConfig.minDate = { year: 2022, month: 1, day: 1 };
    timepickerConfig.spinners = false;
    timepickerConfig.seconds = false;
  }

  private readonly intervalMapping: Record<
    ChatGPTUsageInterval,
    (date: Date, n: number) => number
  > = {
    [ChatGPTUsageInterval.minute]: (date, n) => +date + n * 60 * 1e3,
    [ChatGPTUsageInterval.hour]: (date, n) => +date + n * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.day]: (date, n) => +date + n * 24 * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.week]: (date, n) => +date + n * 7 * 24 * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.month]: (date, n) => {
      const newDate = new Date(date);
      newDate.setMonth(newDate.getMonth() + n);
      return +newDate;
    },
    [ChatGPTUsageInterval.year]: (date, n) => {
      const newDate = new Date(date);
      newDate.setFullYear(newDate.getFullYear() + n);
      return +newDate;
    },
  };

  readonly intervalController: DropdownController<ChatGPTUsageInterval> = (() => {
    const entities = Object.values(ChatGPTUsageInterval);
    const current$ = new BehaviorSubject<ChatGPTUsageInterval>(ChatGPTUsageInterval.day);
    return {
      entities,
      current$,
      select: (interval: ChatGPTUsageInterval) => current$.next(interval),
    };
  })();

  readonly userController$ = this.accountService.getUsers().pipe(
    map(({ results }) => results),
    map((entities) => dropdownControllerFactory(entities)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly datesChange$ = new ReplaySubject<Partial<Period>>(1);
  readonly period$: Observable<Period> = this.datesChange$.pipe(
    startWith({
      start: dateToTimestampS(this.nIntervalFrom(new Date(), ChatGPTUsageInterval.month, -6)),
    } as Period),
    map((period: Period) =>
      period.start > period.end
        ? {
            start: period.end,
            end: period.start,
          }
        : period
    ),
    map((period: Period) => _omitBy(_isNil, period) as Period),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly usage$ = combineLatest([
    this.intervalController.current$,
    this.period$,
    this.userController$.pipe(switchMap(({ current$ }) => current$)),
  ]).pipe(
    switchMap(([interval, period, user]) =>
      this.chatgptUsageService
        .getUsage(interval ? { ...period, interval } : period, user?.id)
        .pipe(catchError(() => of({})))
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * Returns a timestamp n intervals from the given date
   * @param date - date to start from
   * @param interval - interval to use
   * @param n - number of intervals to add (might be negative)
   */
  nIntervalFrom(date: Date, interval: ChatGPTUsageInterval, n: number): number {
    return this.intervalMapping[interval](date, n);
  }
}
