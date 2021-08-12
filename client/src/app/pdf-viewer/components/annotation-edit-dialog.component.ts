import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Annotation } from '../annotation-type';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, DatabaseType } from 'app/shared/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Hyperlink } from '../../drawing-tool/services/interfaces';
import { SEARCH_LINKS } from 'app/shared/links';
import { AnnotationType } from 'app/shared/constants';

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
  // needed to make links inside *ngFor to work and be clickable
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationEditDialogComponent extends CommonFormDialogComponent {
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[][];
  @Input() set allText(allText: string) {
    this.form.patchValue({text: allText});
  }
  isTextEnabled = false;
  sourceLinks: Hyperlink[] = [];

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl({value: '', disabled: true}, Validators.required),
    entityType: new FormControl('', Validators.required),
    id: new FormControl(''),
    source: new FormControl(DatabaseType.NONE),
    sourceLinks: new FormArray([]),
    includeGlobally: new FormControl(false),
  });
  caseSensitiveTypes = [AnnotationType.Gene, AnnotationType.Protein];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  disableGlobalOption() {
    if (['Mutation', 'Pathway', 'Lab Strain', 'Lab Sample'].includes(this.form.get('entityType').value)) {
      this.form.get('includeGlobally').patchValue(false);
      this.form.get('includeGlobally').disable();
      this.toggleIdFieldValidity();
    } else {
      this.form.get('includeGlobally').enable();
    }
  }

  get databaseTypeChoices(): string[] {
    let choices = null;
    const value = this.form.get('entityType').value;
    const dropdown = this.form.get('source');
    if (value === '') {
      dropdown.disable();
      choices = [DatabaseType.NONE];
    } else {
      dropdown.enable();
      if (ENTITY_TYPE_MAP.hasOwnProperty(value)) {
        if (ENTITY_TYPE_MAP[value].sources.indexOf(DatabaseType.NONE) > -1) {
          dropdown.disable();
          choices = [DatabaseType.NONE];
        } else {
          dropdown.enable();
          choices = ENTITY_TYPE_MAP[value].sources;
        }
      }
    }
    return choices;
  }

  get getSearchLinks() {
    const formRawValues = this.form.getRawValue();
    const text = formRawValues.text.trim();

    return SEARCH_LINKS.map(link => (
      {domain: `${link.domain.replace('_', ' ')}`, link: `${link.url}${text}`}));
  }

  getValue(): Annotation {
    const links = {};
    // getRawValue will return values of disabled controls too
    const formRawValues = this.form.getRawValue();
    const text = formRawValues.text.trim();
    SEARCH_LINKS.forEach(link => {
      links[link.domain.toLowerCase()] = this.substituteLink(link.url, text);
    });

    return {
      pageNumber: this.pageNumber,
      keywords: this.keywords.map(keyword => keyword.trim()),
      rects: this.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        id: this.form.value.includeGlobally ? this.form.value.id : (this.form.value.id || text),
        idHyperlinks: this.sourceLinks.length > 0 ? this.sourceLinks.map(
          link => JSON.stringify({label: link.domain, url: link.url})) : [],
        idType: this.form.value.source,
        type: this.form.value.entityType,
        links,
        isCustom: true,
        allText: text,
        includeGlobally: formRawValues.includeGlobally,
        isCaseInsensitive: !(this.caseSensitiveTypes.includes(this.form.value.entityType)),
      },
    };
  }

  substituteLink(s: string, query: string) {
    return s.replace(/%s/, encodeURIComponent(query));
  }

  toggleIdFieldValidity() {
    // user should provide id if annotation is flagged for a global inclusion
    if (this.form.value.includeGlobally) {
      this.form.controls.id.setValidators([Validators.required]);
    } else {
      this.form.controls.id.setValidators(null);
    }
    this.form.controls.id.updateValueAndValidity();
  }

  enableTextField() {
    this.isTextEnabled = true;
    this.form.controls.text.enable();
  }
}
