import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';

import { isEmpty, isNil } from 'lodash-es';
import { iif, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { OrganismAutocomplete, OrganismsResult } from 'app/interfaces';

import { ORGANISM_AUTOCOMPLETE_DEFAULTS } from '../constants';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss'],
})
export class OrganismAutocompleteComponent implements OnChanges {
  @Input() organismTaxId: string;

  @Output() organismPicked = new EventEmitter<OrganismAutocomplete | null>();

  @Input() inputText = '';
  // TODO: All observables should be readonly
  @Output() inputTextChange = new Subject<string>();

  readonly searcher$: Observable<OrganismAutocomplete[]> = this.inputTextChange.pipe(
    distinctUntilChanged(),
    debounceTime(300),
    tap(() => {
      this.isFetching = true;
      this.isOrganismSelected = false;
      this.organismPicked.emit(null);
    }),
    switchMap((q) =>
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
          })
        )
      )
    ),
    tap(() => (this.isFetching = false))
  );

  fetchFailed = false;
  isFetching = false;
  isOrganismSelected = false;

  organismShortlist: OrganismAutocomplete[] = ORGANISM_AUTOCOMPLETE_DEFAULTS;

  constructor(private search: SharedSearchService) {}

  setInputText(text: string) {
    this.inputText = text;
    this.inputTextChange.next(this.inputText);
  }

  ngOnChanges({ inputText, organismTaxId }: SimpleChanges): void {
    if (organismTaxId && organismTaxId.currentValue) {
      this.search.getOrganismFromTaxId(organismTaxId.currentValue).subscribe((response) => {
        // If response is null that means there was no match found
        if (!isNil(response)) {
          this.inputText = response.organism_name;
          this.isOrganismSelected = true;
        }
      });
    }
    if (inputText && inputText.currentValue) {
      this.setInputText(inputText.currentValue);
    }
  }

  selectOrganism(organism: OrganismAutocomplete) {
    this.isOrganismSelected = true;
    this.setInputText(organism.organism_name);
    this.organismPicked.emit(organism);
  }

  clear() {
    this.isOrganismSelected = false;
    this.setInputText(''); // Clear the result list
    this.organismPicked.emit(null);
  }
}
