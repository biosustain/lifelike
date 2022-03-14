import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';

import { iif, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { isEmpty } from 'lodash';

import { SharedSearchService } from 'app/shared/services/shared-search.service';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';

import { ORGANISM_AUTOCOMPLETE_DEFAULTS } from '../constants';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss']
})
export class OrganismAutocompleteComponent implements OnInit {
  @Input() organismTaxId: string;

  @Output() organismPicked = new EventEmitter<OrganismAutocomplete|null>();

  inputText = '';
  inputText$ = new Subject<string>();

  searcher$: Observable<OrganismAutocomplete[]> = this.inputText$.pipe(
    distinctUntilChanged((prev, curr) => prev.toLocaleLowerCase() === curr.toLocaleLowerCase()),
    debounceTime(300),
    tap(() => {
      this.isFetching = true;
      this.organism = null;
      this.organismPicked.emit(null);
    }),
    switchMap(q =>
      iif(
        () => isEmpty(q),
        of([]),
        this.search.getOrganisms(q, 10).pipe(
          catchError(() => {
            this.fetchFailed = true;
            return of([]);
          }),
          map((organisms: OrganismsResult) => {
            this.fetchFailed = false;
            return organisms.nodes;
          }),
        )
      )
    ),
    tap(() => this.isFetching = false)
  );

  fetchFailed = false;
  isFetching = false;

  organismShortlist: OrganismAutocomplete[] = ORGANISM_AUTOCOMPLETE_DEFAULTS;
  organism: OrganismAutocomplete;

  constructor(private search: SharedSearchService) {}

  ngOnInit() {
    if (this.organismTaxId) {
      this.search.getOrganismFromTaxId(
        this.organismTaxId
      ).subscribe(
        (response) => {
          this.inputText = response.organism_name;
          this.organism = response;
        }
      );
    }
  }

  selectOrganism(organism: OrganismAutocomplete) {
    this.organism = organism;
    this.inputText = organism.organism_name;
    this.organismPicked.emit(organism);
  }

  clear() {
    this.organism = null;
    this.inputText = '';
    this.inputText$.next(this.inputText); // Clear the result list
    this.organismPicked.emit(null);
  }
}
