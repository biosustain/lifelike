import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable } from 'rxjs';
import { debounceTime, flatMap, map, tap } from 'rxjs/operators';
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
  organisms: Observable<OrganismAutocomplete[]>;
  query = new FormControl('');

  constructor(private search: SharedSearchService) {
    this.organisms = this.query.valueChanges.pipe(
      debounceTime(300),
      tap(q => {
        if (typeof q === 'string' && q.length === 0) {
          this.organismPicked.emit(null);
        }
      }),
      flatMap(q => {
        if (typeof q !== 'string') { // q is an OrganismAutocomplete when the user selects an option
          return [];
        }
        return this.search.getOrganisms(q).pipe(
          map((organisms: OrganismsResult) => organisms.nodes),
        );
      }),
    );
  }

  displayFn(organism?: OrganismAutocomplete): string | undefined {
    return organism ? organism.organism_name : undefined;
  }

  notifySelection(event: MatAutocompleteSelectedEvent) {
    this.organismPicked.emit(event.option.value);
  }
}
