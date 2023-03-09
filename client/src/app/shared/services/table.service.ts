import { Injectable } from "@angular/core";

import { BehaviorSubject, Observable, of, ReplaySubject, Subject } from "rxjs";
import { debounceTime, delay, switchMap, tap } from "rxjs/operators";

import { SortDirection, SortDirectionType } from "../directives/table-sortable-header.directive";

interface SearchResult {
  data: any[];
  total: number;
}

interface State {
  page: number;
  pageSize: number;
  searchTerm: string;
  sortColumn: string;
  sortDirection: SortDirectionType;
}

const compare = (v1: string | number, v2: string | number) => (v1 < v2 ? -1 : v1 > v2 ? 1 : 0);

function sort(data: any[], column: string, direction: SortDirectionType): any[] {
  if (direction === "" || column === "") {
    return data;
  } else {
    return [...data].sort((a, b) => {
      const res = compare(a[column], b[column]);
      return direction === SortDirection.asc ? res : -res;
    });
  }
}

function matches(data: any, term: string) {
  const lowerCaseTerm = term.toLowerCase();
  return Object.values(data).some((d) => String(d).toLowerCase().includes(lowerCaseTerm));
}

@Injectable()
export class DataService {
  private _search$ = new Subject<void>();
  private _state: State = {
    page: 1,
    pageSize: 4,
    searchTerm: "",
    sortColumn: "",
    sortDirection: "",
  };

  private _loading$ = new BehaviorSubject<boolean>(true);

  get loading$() {
    return this._loading$.asObservable();
  }

  private _data$ = new ReplaySubject<any[]>(1);

  get data$() {
    return this._data$.asObservable();
  }

  private _total$ = new ReplaySubject<number>(1);

  get total$() {
    return this._total$.asObservable();
  }

  _inputData;

  set inputData(data) {
    this._inputData = data || [];
    this._search$.next(data || []);
  }

  get page() {
    return this._state.page;
  }

  set page(page: number) {
    this.patch({ page });
  }

  get pageSize() {
    return this._state.pageSize;
  }

  set pageSize(pageSize: number) {
    this.patch({ pageSize });
  }

  get searchTerm() {
    return this._state.searchTerm;
  }

  set searchTerm(searchTerm: string) {
    this.patch({ searchTerm });
  }

  set sortColumn(sortColumn: string) {
    this.patch({ sortColumn });
  }

  set sortDirection(sortDirection: SortDirectionType) {
    this.patch({ sortDirection });
  }

  constructor() {
    this._search$
      .pipe(
        tap((d) => {
          this._loading$.next(true);
          return d;
        }),
        debounceTime(200),
        switchMap((d) => this._search(d)),
        delay(200),
        tap(() => this._loading$.next(false))
      )
      .subscribe((result) => {
        this._data$.next(result.data);
        this._total$.next(result.total);
      });
  }

  patch(patch: Partial<State>) {
    Object.assign(this._state, patch);
    this._search$.next(this._inputData);
  }

  private _search(inputData): Observable<SearchResult> {
    const { sortColumn, sortDirection, pageSize, page, searchTerm } = this._state;

    // 1. sort
    let data = sort(inputData, sortColumn, sortDirection);

    // 2. filter
    data = data.filter((d) => matches(d, searchTerm));
    const total = data.length;

    // 3. paginate
    data = data.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return of({ data, total });
  }
}
