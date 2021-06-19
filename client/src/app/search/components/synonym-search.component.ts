import { SelectionModel } from '@angular/cdk/collections';
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { KG_VIZ_FILTER_TYPES, ORGANISM_SHORTLIST } from 'app/shared/constants';
import { uuidv4 } from 'app/shared/utils';

import { ContentSearchService } from '../services/content-search.service';
import { SynonymData } from '../shared';

@Component({
  selector: 'app-synonym-search',
  templateUrl: './synonym-search.component.html',
  styleUrls: ['./synonym-search.component.scss']
})
export class SynonymSearchComponent {
  id = uuidv4();

  synonymData: SynonymData[];
  entityChecklistSelection = new SelectionModel<SynonymData>(true /* multiple */);

  typeFilters = KG_VIZ_FILTER_TYPES.filter(type => type !== 'Protein');
  selectedTypeFilters: string[] = [];
  organismFilters = Array.from(ORGANISM_SHORTLIST.keys());
  selectedOrganismFilters: string[] = [];
  typeChecklistSelection = new SelectionModel<string>(true /* multiple */);
  organismChecklistSelection = new SelectionModel<string>(true /* multiple */);

  form = new FormGroup({
    q: new FormControl('', Validators.required),
  });

  SYNONYM_SEARCH_LIMIT = 100;
  page = 1;
  total: number;

  loading = false;
  errorMsg: string = null;

  mostRecentSearchTerm: string;

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly contentSearchService: ContentSearchService,
  ) {}

  dismiss() {
    this.modal.dismiss();
  }

  submitSearch() {
    this.errorMsg = null;
    if (this.form.valid) {
      this.page = 1;
      this.searchSynonyms();
    }
    this.form.markAsDirty();
  }

  searchSynonyms() {
    this.loading = true;
    this.synonymData = [];
    this.mostRecentSearchTerm = this.form.value.q;
    this.contentSearchService.getSynoynms(
      this.form.value.q,
      this.selectedOrganismFilters.map((organism) => ORGANISM_SHORTLIST.get(organism)),
      this.selectedTypeFilters,
      this.page,
      this.SYNONYM_SEARCH_LIMIT
    ).subscribe(
      (result) => {
        this.loading = false;
        this.synonymData = result.data;
        this.total = result.count;
      },
      (error) => {
        this.loading = false;
        try {
          this.errorMsg = error.error.message;
        } catch (err) {
          this.errorMsg = 'A system error occurred while searching for synonyms, we are working on a solution. Please try again later.';
        }
      }
    );
  }

  submit() {
    const synonymsToAdd = new Set<string>();
    this.synonymData.forEach(entity => {
      if (this.entityChecklistSelection.isSelected(entity)) {
        const regex = /\W+/g;
        entity.synonyms.forEach((synonym: string) => {
          const synonymHasNonWordChars = synonym.match(regex);
          synonymsToAdd.add((synonymHasNonWordChars ? `"${synonym.toLowerCase()}"` : synonym.toLowerCase()));
        });
      }
    });
    this.modal.close(Array.from(synonymsToAdd));
  }

  toggleEntitySelection(entity: SynonymData) {
    this.entityChecklistSelection.toggle(entity);
  }

  toggleFilterSelection(checklist: SelectionModel<string>, filter: string) {
    checklist.toggle(filter);
  }

  allEntitiesChecked() {
    return this.synonymData.every((entity) => this.entityChecklistSelection.isSelected(entity));
  }

  toggleAllEntities() {
    // Just get the current state of the checkbox so we don't have to check the synonym data unnecessarily
    const checkboxHeader = document.getElementById(this.id + '-synonym-checklist-header') as HTMLInputElement;

    if (checkboxHeader.checked) {
      this.synonymData.forEach(entity => this.entityChecklistSelection.select(entity));
    } else {
      this.synonymData.forEach(entity => this.entityChecklistSelection.deselect(entity));
    }
  }

  goToPage(page: number) {
    this.page = page;
    this.searchSynonyms();
  }

  organismFiltersChanged(filters: string[]) {
    this.selectedOrganismFilters = filters;
  }

  typeFiltersChanged(filters: string[]) {
    this.selectedTypeFilters = filters;
  }
}
