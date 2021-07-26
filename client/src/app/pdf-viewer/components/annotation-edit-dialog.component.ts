import { Component, Input } from '@angular/core';
import { Annotation } from '../annotation-type';
import { ENTITY_TYPE_MAP, ENTITY_TYPES, DatabaseType, EntityType } from 'app/shared/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Hyperlink } from '../../drawing-tool/services/interfaces';
import { SEARCH_LINKS } from 'app/shared/links';
import { cloneDeep } from 'lodash';
import { AnnotationType } from 'app/shared/constants';

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
})
export class AnnotationEditDialogComponent extends CommonFormDialogComponent {
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[][];
  @Input() set allText(allText: string) {
    this.form.patchValue({text: allText});
  }
  linkTemplates: Hyperlink[] = cloneDeep(SEARCH_LINKS);
  isTextEnabled = false;

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl({value: '', disabled: true}, Validators.required),
    entityType: new FormControl('', Validators.required),
    id: new FormControl(''),
    source: new FormControl(DatabaseType.NONE, Validators.required),
    sourceLink: new FormControl(''),
    includeGlobally: new FormControl(false),
  });
  caseSensitiveTypes = [AnnotationType.Gene, AnnotationType.Protein];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  get entityTypeChosen(): boolean {
    return this.form.get('entityType').value !== '';
  }

  get databaseTypeChoices(): string[] {
    const value = this.form.get('entityType').value;
    if (ENTITY_TYPE_MAP) {
      // ????
    }
    if (ENTITY_TYPE_MAP.hasOwnProperty(value)) {
      return ENTITY_TYPE_MAP[value].sources;
    }
    return [DatabaseType.NONE];
  }

  getValue(): Annotation {
    const links = {};
    // getRawValue will return values of disabled controls too
    const text = this.form.getRawValue().text.trim();
    this.linkTemplates.forEach(link => {
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
        idHyperlink: this.form.value.sourceLink.trim(),
        idType: this.form.value.source,
        type: this.form.value.entityType,
        links,
        isCustom: true,
        allText: text,
        includeGlobally: this.form.value.includeGlobally,
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
      this.form.controls.id.updateValueAndValidity();
    } else {
      this.form.controls.id.setValidators(null);
      this.form.controls.id.updateValueAndValidity();
    }
  }

  enableTextField() {
    this.isTextEnabled = true;
    this.form.controls.text.enable();
  }
}
