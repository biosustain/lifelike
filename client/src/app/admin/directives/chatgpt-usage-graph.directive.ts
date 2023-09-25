import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

import { Subject } from 'rxjs';

import * as PlotlyType from 'plotly.js';
import { Layout, PlotData } from 'plotly.js';
import { ChatGPTUsageInterval, ChatGPTUsageResponse } from '../services/chatgpt-usage.service';

declare const Plotly: typeof PlotlyType;

type PlotConfig = Partial<Omit<PlotData, 'x' | 'y'>>;
type XY = Pick<PlotData, 'x' | 'y'>;
type LazyLayout = Partial<Layout> | { lazy: (data: PlotData) => Partial<Layout> };

const dayOfTheYear = (date: Date) =>
  Math.floor((+date - +new Date(date.getFullYear(), 0, 1)) / (24 * 60 * 60 * 1e3));
const weekOfTheYear = (date: Date) => Math.floor(dayOfTheYear(date) / 7);

@Directive({ selector: 'app-chatgpt-usage-graph, [appChatgptUsageGraph]' })
export class ChatgptUsageGraphDirective implements OnChanges, OnInit {
  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  @Input() usage!: ChatGPTUsageResponse;
  private readonly redraw$ = new Subject();
  private readonly layout: Partial<Layout> = {
    title: 'ChatGPT Usage',
    xaxis: {
      title: 'Time',
      type: 'date',
    },
    yaxis: {
      title: 'Tokens',
    },
  };
  private readonly data: Partial<PlotData> = {
    type: 'bar',
  };
  private readonly destroy$: Subject<void> = new Subject();

  // D3 datetime format strings
  // https://github.com/d3/d3-time-format/blob/main/README.md
  private readonly intervalLabelMapping: Record<ChatGPTUsageInterval, string> = {
    [ChatGPTUsageInterval.minute]: '%I:%M',
    [ChatGPTUsageInterval.hour]: '%I %p',
    [ChatGPTUsageInterval.day]: '%a %d',
    [ChatGPTUsageInterval.week]: '%b %d',
    [ChatGPTUsageInterval.month]: '%B',
    [ChatGPTUsageInterval.year]: '%Y',
  };

  private readonly intervalLengthMapping: Record<ChatGPTUsageInterval, number> = {
    [ChatGPTUsageInterval.minute]: 60 * 1e3,
    [ChatGPTUsageInterval.hour]: 60 * 60 * 1e3,
    [ChatGPTUsageInterval.day]: 24 * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.week]: 7 * 24 * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.month]: 30 * 24 * 60 * 60 * 1e3,
    [ChatGPTUsageInterval.year]: 365 * 24 * 60 * 60 * 1e3,
  };

  private readonly BAR_WIDTH = 0.8;

  private readonly intervalStartMapping: Record<ChatGPTUsageInterval, (date: Date) => Date> = {
    [ChatGPTUsageInterval.minute]: (date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes()
      ),
    [ChatGPTUsageInterval.hour]: (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()),
    [ChatGPTUsageInterval.day]: (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    [ChatGPTUsageInterval.week]: (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()),
    [ChatGPTUsageInterval.month]: (date) => new Date(date.getFullYear(), date.getMonth()),
    [ChatGPTUsageInterval.year]: (date) => new Date(date.getFullYear(), 0),
  };

  ngOnInit() {
    Plotly.newPlot(this.elementRef.nativeElement, [this.data], this.layout, { responsive: true });
  }

  ngOnChanges({ usage, labels }: SimpleChanges) {
    if (usage) {
      // region Update data
      const results = usage.currentValue?.results ?? [];
      const interval = usage.currentValue?.query.interval;
      // Convert X values to dates
      const xDates = results.map((result) => new Date(1e3 * result.start));
      if (interval) {
        // If we are showing interval data, we need to set the x values to the middle of the interval
        // and set the width of the bars to the interval length
        const intervalStart = this.intervalStartMapping[interval];
        const intervalLength = this.intervalLengthMapping[interval];
        this.data.x = xDates.map((date) => +intervalStart(date) + intervalLength * 0.5);
        this.data.width = intervalLength * this.BAR_WIDTH;
      } else {
        this.data.x = xDates;
        this.data.width = undefined; // default width
      }
      // Set Y values
      this.data.y = results.map(({ value }) => value);
      if (!usage.firstChange) {
        // if we have already initialized the plot
        Plotly.redraw(this.elementRef.nativeElement);
      }
      // endregion
      // region Update layout
      this.layout.xaxis.title = interval ? `Time (grouped by ${interval})` : 'Time';
      // Make tickformat correspond to optional interval
      this.layout.xaxis.tickformat = this.intervalLabelMapping[interval];
      const start = usage.currentValue?.query.start;
      const end = usage.currentValue?.query.end;
      this.layout.xaxis.range = [start * 1e3, end * 1e3 || Date.now()];
      if (!usage.firstChange) {
        // if we have already initialized the plot
        Plotly.relayout(this.elementRef.nativeElement, this.layout);
      }
      // endregion
    }
  }
}
