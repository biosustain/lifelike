import { Injectable } from '@angular/core';

import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

interface ResultSummary {
  searching?: boolean;
  matchesCount?: {
    current: number,
    total: number
  };
}

@Injectable()
export class PDFSearchService {
  public resultSummary$ = new ReplaySubject<ResultSummary>(1);
  public query$ = new ReplaySubject<string>(1);
  public next$ = new Subject();
  public prev$ = new Subject();
}
