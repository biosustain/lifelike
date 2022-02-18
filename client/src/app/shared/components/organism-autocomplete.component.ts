import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';

import { merge, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';

import { SharedSearchService } from 'app/shared/services/shared-search.service';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';

import { ORGANISM_SHORTLIST } from '../constants';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss']
})
export class OrganismAutocompleteComponent implements OnInit {
  @Input() organismTaxId: string;

  @Output() organismPicked = new EventEmitter<OrganismAutocomplete|null>();

  focus$ = new Subject<string>();

  fetchFailed = false;
  isFetching = false;

  organismShortlist: OrganismAutocomplete[];
  organismShortListSeparator: OrganismAutocomplete;

  organism: OrganismAutocomplete;

  constructor(private search: SharedSearchService) {}

  ngOnInit() {
    this.organismShortlist = Array.from(ORGANISM_SHORTLIST.entries()).map(([organismName, organismTaxId]) => {
      return {
        organism_name: organismName,
        synonym: organismName,
        tax_id: organismTaxId
      } as OrganismAutocomplete;
    });
    this.organismShortListSeparator = {
      organism_name: '-'.repeat(50),
      synonym: '',
      tax_id: ''
    };

    if (this.organismTaxId) {
      this.search.getOrganismFromTaxId(
        this.organismTaxId
      ).subscribe(
        (response) => this.organism = response
      );
    }
  }

  searcher = (text$: Observable<string>) => {
    const distinctText$ = text$.pipe(distinctUntilChanged((prev, curr) => prev.toLocaleLowerCase() === curr.toLocaleLowerCase()));
    const inputFocus$ = this.focus$;

    return merge(distinctText$, inputFocus$).pipe(
      debounceTime(300),
      tap(() => {
        this.isFetching = true;
        this.organismPicked.emit(null);
      }),
      switchMap(q => q === ''
        ? of(this.organismShortlist)
        : this.search.getOrganisms(q, 10).pipe(
            catchError(() => {
              this.fetchFailed = true;
              return of([]);
            }),
            map((organisms: OrganismsResult) => {
              this.fetchFailed = false;
              return [
                ...this.organismShortlist,
                organisms.nodes.length ? this.organismShortListSeparator : [],
                ...organisms.nodes
              ];
            }),
          )
      ),
      tap(() => this.isFetching = false)
    );
  }

  formatter = (organism: OrganismAutocomplete) => organism.organism_name;

  notifySelection(event: NgbTypeaheadSelectItemEvent) {
    if (event.item === this.organismShortListSeparator) {
      // This prevents the ngbTypeahead from updating the model
      event.preventDefault();
      this.clear();
      return;
    }
    this.organism = event.item;
    this.organismPicked.emit(event.item);
  }

  clear() {
    this.organism = undefined;
    this.organismPicked.emit(null);
  }
}
