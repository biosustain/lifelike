import { Component, EventEmitter, Output } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss']
})
export class OrganismAutocompleteComponent {
  @Output() organismPicked = new EventEmitter<OrganismAutocomplete|null>();
  fetchFailed = false;
  isFetching = false;
  model: any;

  constructor(private search: SharedSearchService) {
  }

  searcher = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged((prev, curr) => prev.toLocaleLowerCase() === curr.toLocaleLowerCase()),
    tap(() => {
      this.isFetching = true;
      this.organismPicked.emit(null);
    }),
    switchMap(q =>
      this.search.getOrganisms(q, 10).pipe(
        tap(() => this.fetchFailed = false),
        catchError(() => {
          this.fetchFailed = true;
          return of([]);
        }),
        map((organisms: OrganismsResult) => organisms.nodes),
      )
    ),
    tap(() => this.isFetching = false),
  )

  formatter = (organism: OrganismAutocomplete) => organism.organism_name;

  notifySelection(event: NgbTypeaheadSelectItemEvent) {
    this.organismPicked.emit(event.item);
  }
}
