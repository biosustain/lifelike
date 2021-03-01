import { Injectable, PipeTransform } from '@angular/core';

import { BehaviorSubject, Observable, of, Subject } from 'rxjs';

import { DecimalPipe } from '@angular/common';
import { debounceTime, delay, switchMap, tap } from 'rxjs/operators';
import { SortColumn, SortDirection } from './sortable.directive';

interface SearchResult {
  data: any[];
  total: number;
}

interface State {
  page: number;
  pageSize: number;
  searchTerm: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}

const compare = (v1: string | number, v2: string | number) => v1 < v2 ? -1 : v1 > v2 ? 1 : 0;

function sort(data: any[], column: SortColumn, direction: string): any[] {
  if (direction === '' || column === '') {
    return data;
  } else {
    return [...data].sort((a, b) => {
      const res = compare(a[column], b[column]);
      return direction === 'asc' ? res : -res;
    });
  }
}

function matches(data: any, term: string, pipe: PipeTransform) {
  const lowerCaseTerm = term.toLowerCase();
  return Object.values(data).some(d => String(d).toLowerCase().includes(lowerCaseTerm));
}

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class DataService {
  private _loading$ = new BehaviorSubject<boolean>(true);
  private _search$ = new Subject<void>();
  private _data$ = new BehaviorSubject<any[]>([]);
  private _total$ = new BehaviorSubject<number>(0);

  private _state: State = {
    page: 1,
    pageSize: 4,
    searchTerm: '',
    sortColumn: '',
    sortDirection: ''
  };

  _inputData;

  constructor(private pipe: DecimalPipe) {
    this._search$.pipe(
      tap(d => {
        this._loading$.next(true);
        return d;
      }),
      debounceTime(200),
      switchMap(d => this._search(d)),
      delay(200),
      tap(() => this._loading$.next(false))
    ).subscribe(result => {
      this._data$.next(result.data);
      this._total$.next(result.total);
    });
  }

  get data$() {
    return this._data$.asObservable();
  }

  get total$() {
    return this._total$.asObservable();
  }

  get loading$() {
    return this._loading$.asObservable();
  }

  get page() {
    return this._state.page;
  }

  get pageSize() {
    return this._state.pageSize;
  }

  get searchTerm() {
    return this._state.searchTerm;
  }

  set page(page: number) {
    this._set({page});
  }

  set pageSize(pageSize: number) {
    this._set({pageSize});
  }

  set searchTerm(searchTerm: string) {
    this._set({searchTerm});
  }

  set sortColumn(sortColumn: SortColumn) {
    this._set({sortColumn});
  }

  set sortDirection(sortDirection: SortDirection) {
    this._set({sortDirection});
  }

  private _set(patch: Partial<State>) {
    Object.assign(this._state, patch);
    this._search$.next(this._inputData);
  }

  set inputData(data) {
    this._inputData = data;
    console.log(data);
    this._search$.next(data);
  }

  private _search(inputData): Observable<SearchResult> {
    const {sortColumn, sortDirection, pageSize, page, searchTerm} = this._state;

    // 1. sort
    let data = sort(inputData, sortColumn, sortDirection);

    // 2. filter
    data = data.filter(d => matches(d, searchTerm, this.pipe));
    const total = data.length;

    // 3. paginate
    data = data.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return of({data, total});
  }
}
