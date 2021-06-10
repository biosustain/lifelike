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

  loading = false;

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly contentSearchService: ContentSearchService,
  ) {}

  dismiss() {
    this.modal.dismiss();
  }

  search() {
    if (this.form.valid) {
      this.loading = true;
      this.contentSearchService.getSynoynms().subscribe((result) => {
        this.loading = false;
        this.synonymData = result;
      });
    }
    this.form.markAsDirty();
  }

  submit() {
    const synonymsToAdd = new Set<string>();
    this.synonymData.forEach(entity => {
      if (this.checklistSelection.isSelected(entity)) {
        // /\W+/g
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
}
