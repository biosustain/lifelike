import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { debounceTime, flatMap, map, tap } from 'rxjs/operators';
import { SearchService } from 'app/search/services/search.service';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss']
})
export class OrganismAutocompleteComponent {
  @Output() organismPicked = new EventEmitter<OrganismAutocomplete|null>();
  organisms: Observable<OrganismAutocomplete[]>;
  query = new FormControl('');

  constructor(private searchService: SearchService) {
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
        return this.searchService.getOrganisms(q).pipe(
          map((organisms: OrganismsResult) => organisms.nodes),
        );
      }),
    );
  }

  displayFn(organism?: OrganismAutocomplete): string | undefined {
    return organism ? organism.organism_name : undefined;
  }

  notifySelection(event: MatAutocompleteSelectedEvent) {
    console.log('event', event);
    this.organismPicked.emit(event.option.value);
  }
}
