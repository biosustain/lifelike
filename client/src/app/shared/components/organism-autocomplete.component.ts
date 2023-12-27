import { Component, Output, Input, OnChanges, SimpleChanges } from '@angular/core';

import { isEmpty, isNil } from 'lodash-es';
import { iif, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { OrganismAutocomplete, OrganismsResult } from 'app/interfaces';

import { ORGANISM_AUTOCOMPLETE_DEFAULTS } from '../constants';
import { addStatus, PipeStatus } from '../pipes/add-status.pipe';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss'],
})
export class OrganismAutocompleteComponent implements OnChanges {
  constructor(private search: SharedSearchService) {}
  @Input() organismTaxId: string;

  @Output() organismPicked = new ReplaySubject(1);

  @Input() inputText = '';
  @Output() readonly inputTextChange = new Subject<string>();

  readonly search$: Observable<PipeStatus<OrganismAutocomplete[]>> = this.inputTextChange.pipe(
    startWith(''),
    distinctUntilChanged(),
    debounceTime(300),
    switchMap((q) =>
      iif(
        () => isEmpty(q),
        of([]),
        this.search.getOrganisms(q, 10).pipe(map((organisms: OrganismsResult) => organisms.nodes))
      ).pipe(addStatus())
    )
  );

  organismShortlist: OrganismAutocomplete[] = ORGANISM_AUTOCOMPLETE_DEFAULTS;

  setInputText(text: string) {
    this.inputText = text;
    this.inputTextChange.next(this.inputText);
  }

  ngOnChanges({ inputText, organismTaxId }: SimpleChanges): void {
    if (organismTaxId) {
      this.search.getOrganismFromTaxId(organismTaxId.currentValue).subscribe((response) => {
        // If response is null that means there was no match found
        if (!isNil(response)) {
          this.inputText = response.organism_name;
          this.organismPicked.next(response);
        }
      });
    }
    if (inputText) {
      this.setInputText(inputText.currentValue);
    }
  }

  selectOrganism(organism: OrganismAutocomplete) {
    this.setInputText(organism.organism_name);
    this.organismPicked.next(organism);
  }

  clear() {
    this.setInputText('');
    this.organismPicked.next(null);
  }
}