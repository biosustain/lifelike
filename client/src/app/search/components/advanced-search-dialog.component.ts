import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ContentSearchOptions, Project, TYPES } from '../content-search';
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
  projectIds: string[] = [];
  projectsMap: Map<string, string>;

  form = new FormGroup({
    q: new FormControl('', [this.whitespaceValidator]),
    types: new FormControl([]),
    projects: new FormControl([]),
  });

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly contentSearchService: ContentSearchService,
  ) {
    this.projectsMap = new Map<string, string>();
  }

  ngOnInit() {
    this.contentSearchService.getProjects().subscribe((projects: Project[]) => {
      projects.forEach(project => {
        // Need to convert to string to match query params
        const projectIdAsString = project.id.toString();
        if (!this.projectIds.includes(projectIdAsString)) {
          this.projectIds.push(projectIdAsString);
        }
        this.projectsMap.set(projectIdAsString, project.projectName);
      });
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
  projectLabel() {
    return (choice: string) => this.projectsMap.get(choice);
  }

  whitespaceValidator(control: AbstractControl): {[key: string]: any} | null {
    const val =  control.value as string;
    return val.length > 0 && val.match(/.*\S.*/) === null ? {whitespace: {value: control.value}} : null;
  }
}
