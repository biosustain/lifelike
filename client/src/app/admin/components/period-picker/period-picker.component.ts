import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { BehaviorSubject, ReplaySubject } from 'rxjs';
import {
  NgbCalendar,
  NgbDateNativeAdapter,
  NgbDateStruct,
  NgbTimeStruct,
} from '@ng-bootstrap/ng-bootstrap';
import { map, shareReplay } from 'rxjs/operators';

import { ChatGPTUsageInterval } from '../../services/chatgpt-usage.service';
import { Period } from '../chatgpt-usage/chatgpt-usage.component';

const intervalMapping: Record<ChatGPTUsageInterval, (date: Date, n: number) => number> = {
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

/**
 * Returns a timestamp n intervals from the given date
 * @param date - date to start from
 * @param interval - interval to use
 * @param n - number of intervals to add (might be negative)
 */
const nIntervalFrom = (date: Date, interval: ChatGPTUsageInterval, n: number): number =>
  intervalMapping[interval](date, n);

const nIntervalFromNow = (interval: ChatGPTUsageInterval, n: number): number =>
  nIntervalFrom(new Date(), interval, n);

export interface DatetimeStruct {
  date: NgbDateStruct;
  time: NgbTimeStruct;
}

const toDate = (datetime: DatetimeStruct): Date =>
  new Date(
    datetime.date.year,
    datetime.date.month - 1,
    datetime.date.day,
    datetime.time.hour,
    datetime.time.minute,
    datetime.time.second
  );

const toDatetimeStruct = (date: Date): DatetimeStruct => ({
  date: {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  },
  time: {
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  },
});

@Component({
  selector: 'app-period-picker',
  templateUrl: './period-picker.component.html',
  styleUrls: ['./period-picker.component.scss'],
  providers: [NgbDateNativeAdapter],
})
export class PeriodPickerComponent implements OnChanges {
  constructor(private readonly calendar: NgbCalendar) {}

  form = new FormGroup({
    from: new FormGroup({
      date: new FormControl(),
      time: new FormControl(),
    }),
    to: new FormGroup({
      date: new FormControl(),
      time: new FormControl(),
    }),
  });

  private readonly period$ = new ReplaySubject<{
    from: DatetimeStruct;
    to: DatetimeStruct;
  }>(1);

  @Input() period: Period;
  @Output() readonly periodChange: EventEmitter<Period> = new EventEmitter();

  private readonly minuteOptions = [
    {
      label: 'Last 1 minute',
      valueFactory: (now) => nIntervalFromNow(ChatGPTUsageInterval.minute, -1),
    },
    {
      label: 'Last 5 minutes',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.minute, -5),
    },
    {
      label: 'Last 15 minutes',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.minute, -15),
    },
    {
      label: 'Last 30 minutes',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.minute, -30),
    },
  ];

  private readonly hourOptions = [
    { label: 'Last 1 hour', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.hour, -1) },
    { label: 'Last 3 hours', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.hour, -3) },
    { label: 'Last 6 hours', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.hour, -6) },
    {
      label: 'Last 12 hours',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.hour, -12),
    },
  ];

  private readonly dayOptions = [
    { label: 'Last 1 day', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.day, -1) },
    { label: 'Last 2 days', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.day, -3) },
  ];

  private readonly weekOptions = [
    { label: 'Last 1 week', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.week, -1) },
    { label: 'Last 2 weeks', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.week, -2) },
  ];

  private readonly monthOptions = [
    { label: 'Last 1 month', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.month, -1) },
    {
      label: 'Last 2 months',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.month, -2),
    },
    {
      label: 'Last 3 months',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.month, -3),
    },
    {
      label: 'Last 6 months',
      valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.month, -6),
    },
  ];

  private readonly yearOptions = [
    { label: 'Last 1 year', valueFactory: () => nIntervalFromNow(ChatGPTUsageInterval.year, -1) },
  ];

  readonly optionsGroups = [
    this.minuteOptions,
    this.hourOptions,
    this.dayOptions,
    this.weekOptions,
    this.monthOptions,
    this.yearOptions,
  ];

  readonly customOption = {
    label: 'Custom',
    valueFactory: () => 0,
  };

  readonly option$ = new BehaviorSubject(this.monthOptions[3]);

  readonly customPanel$ = this.option$.pipe(
    map((option) => option === this.customOption),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  applyCustom(event) {
    this.periodChange.emit({
      start: toDate(event.from).getTime() / 1e3 || undefined,
      end: toDate(event.to).getTime() / 1e3 || undefined,
    });
  }

  selectOption(option) {
    this.option$.next(option);
    const newValue = toDatetimeStruct(new Date(option.valueFactory()));
    this.form.setValue({ from: newValue, to: { date: {}, time: {} } });
    this.applyCustom(this.form.value);
  }

  ngOnChanges({ period }: SimpleChanges) {
    if (period) {
      const { start, end } = period.currentValue;
      const from = start ? toDatetimeStruct(new Date(1e3 * start)) : { date: {}, time: {} };
      const to = end ? toDatetimeStruct(new Date(1e3 * end)) : { date: {}, time: {} };
      this.form.setValue({
        from,
        to,
      });
    }
  }
}
