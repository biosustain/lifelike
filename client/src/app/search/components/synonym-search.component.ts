import { SelectionModel } from '@angular/cdk/collections';
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ContentSearchService } from '../services/content-search.service';
import { SynonymData } from '../shared';

@Component({
  selector: 'app-synonym-search',
  templateUrl: './synonym-search.component.html',
  styleUrls: ['./synonym-search.component.scss']
})
export class SynonymSearchComponent {
  synonymData: SynonymData[];
  checklistSelection = new SelectionModel<any>(true /* multiple */);

  form = new FormGroup({
    q: new FormControl('', Validators.required),
  });

  SYNONYM_SEARCH_LIMIT = 100;
  page = 1;
  total: number;

  loading = false;
  errorMsg: string = null;

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
    this.contentSearchService.getSynoynms(this.form.value.q, this.page, this.SYNONYM_SEARCH_LIMIT).subscribe(
      (result) => {
        this.loading = false;
        this.synonymData = result.synonyms;
        this.total = result.count;
      },
      (error) => {
        this.loading = false;
        try {
          this.errorMsg = error.error.message;
        } catch (err) {
          this.errorMsg = 'An unknown error occurred during the synonym search. Please check your internet connection and try again.';
        }
      }
    );
  }

  submit() {
    const synonymsToAdd = new Set<string>();
    this.synonymData.forEach(entity => {
      if (this.checklistSelection.isSelected(entity)) {
        const regex = /\W+/g;
        entity.aliases.forEach((alias: string) => {
          const aliasHasNonWordChars = alias.match(regex);
          synonymsToAdd.add((aliasHasNonWordChars ? `"${alias.toLowerCase()}"` : alias.toLowerCase()));
        });
      }
    });
    this.modal.close(Array.from(synonymsToAdd));
  }

  toggleSelection(entity: any) {
    this.checklistSelection.toggle(entity);
  }

  goToPage(page: number) {
    this.page = page;
    this.searchSynonyms();
  }
}
