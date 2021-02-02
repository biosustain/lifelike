import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ContentSearchOptions, TYPES } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { SearchType } from '../shared';

@Component({
  selector: 'app-advanced-search-dialog',
  templateUrl: './advanced-search-dialog.component.html',
  styleUrls: ['./advanced-search-dialog.component.scss']
})
export class AdvancedSearchDialogComponent implements OnInit {
  @Input() set params(params: ContentSearchOptions) {
    this.form.setValue({
      ...this.form.value,
      q: params.q,
      // Advanced Params
      types: params.types ? params.types : [],
      projects: params.projects ? params.projects : [],
    });
  }

  typeChoices: SearchType[] = TYPES.concat().sort((a, b) => a.name.localeCompare(b.name));
  projects: string[] = [];

  form = new FormGroup({
    q: new FormControl('', [Validators.required, this.whitespaceValidator]),
    types: new FormControl([]),
    projects: new FormControl([]),
  });

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly contentSearchService: ContentSearchService,
  ) {
  }

  ngOnInit() {
    this.contentSearchService.getProjects().subscribe((projects: string[]) => {
      this.projects = projects;
    });
  }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    if (this.form.valid) {
      this.modal.close(this.form.value);
    } else {
      this.form.markAsDirty();
    }
  }

  typeLabel(choice) {
    return choice.name;
  }

  projectLabel(choice) {
    return choice;
  }

  whitespaceValidator(control: AbstractControl): {[key: string]: any} | null {
    const val =  control.value as string;
    return val.length > 0 && val.match(/.*\S.*/) === null ? {whitespace: {value: control.value}} : null;
  }
}
