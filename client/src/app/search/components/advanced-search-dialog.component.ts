import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProjectData } from 'app/file-browser/schema';

import { ContentSearchOptions } from '../content-search';
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
      phrase: params.phrase ? params.phrase : '',
      wildcards: params.wildcards ? params.wildcards : '',
    });
  }
  @Input() typeChoices: SearchType[];

  projects: string[] = [];

  form = new FormGroup({
    q: new FormControl('', [this.whitespaceValidator]),
    types: new FormControl([]),
    projects: new FormControl([]),
    phrase: new FormControl(''),
    wildcards: new FormControl(''),
  });

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly contentSearchService: ContentSearchService,
  ) {}

  ngOnInit() {
    this.contentSearchService.getProjects().subscribe((projects: ProjectData[]) => {
      projects.forEach(project => {
        const projectName = project.name;
        if (!this.projects.includes(projectName)) {
          this.projects.push(projectName);
        }
      });

      // Finally, if the user included any projects in the query params that they DON'T actually have access to, remove them from the form.
      // If we don't do this, there will be "ghost" values in the app-select dropdown that won't be visible.
      const formProjectIds = this.form.get('projects').value as string[];
      this.form.get('projects').setValue(formProjectIds.filter(projectId => this.projects.includes(projectId)));
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

  /**
   * Function used by the 'types' app-select component to choose what value is displayed in the dropdown list.
   * @param choice SearchType representing an option in the list
   */
  typeLabel(choice: SearchType) {
    return choice.name;
  }

  /**
   * Function used by the 'projects' app-select component to choose which value is displayed in the dropdown list. Creates and returns a
   * closure to allow the app-select component to use the value of 'this.projectsMap'.
   */
  projectLabel(choice: string) {
    return choice;
  }

  whitespaceValidator(control: AbstractControl): {[key: string]: any} | null {
    const val =  control.value as string;
    return val.length > 0 && val.match(/.*\S.*/) === null ? {whitespace: {value: control.value}} : null;
  }
}
