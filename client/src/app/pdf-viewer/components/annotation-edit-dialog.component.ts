import { Component, Input } from '@angular/core';
import { Annotation } from '../annotation-type';
import { ENTITY_TYPE_MAP, ENTITY_TYPES } from '../../shared/annotation-types';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Hyperlink } from '../../drawing-tool/services/interfaces';
import { SEARCH_LINKS } from '../../shared/links';
import { cloneDeep } from 'lodash';
import { url } from '../../shared/validators';
import { AnnotationType } from 'app/shared/constants';

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
})
export class AnnotationEditDialogComponent extends CommonFormDialogComponent {
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[];
  @Input() set allText(allText: string) {
    this.form.patchValue({
      text: allText
    });
  }
  linkTemplates: Hyperlink[] = cloneDeep(SEARCH_LINKS);
  isTextEnabled = false;

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl({value: '', disabled: true}, Validators.required),
    entityType: new FormControl(this.entityTypeChoices[0].name, Validators.required),
    id: new FormControl(''),
    links: new FormArray([]),
    includeGlobally: new FormControl(false),
  });
  readonly links = this.form.get('links') as FormArray;
  caseSensitiveTypes = [AnnotationType.Gene, AnnotationType.Protein];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
    const linksArray = this.form.get('links') as FormArray;
    for (const link of this.linkTemplates) {
      linksArray.push(new FormControl('', url));
    }
  }

  getValue(): Annotation {
    const text = this.form.getRawValue().text.trim();
    const links = {};
    const sourceDomains = new Set(
      this.linkTemplates.filter(
        link => link.isDatabase).map(
          dbDomain => dbDomain.domain.toLowerCase()));
    // idHyperlink should be taken from the search links (entered by user) considering
    // the priority (elements in SEARCH_LINKS array have the prioritized order)
    let idHyperlink;
    let idType;
    this.form.value.links.forEach((value, i) => {
      const domain = this.linkTemplates[i].domain.toLowerCase();
      links[domain] = value || this.substituteLink(this.linkTemplates[i].url, text);

      if (!idHyperlink && value) {
        idHyperlink = value;
        idType = sourceDomains.has(domain) ? domain.toUpperCase() : '';
      }
    });

    return {
      pageNumber: this.pageNumber,
      keywords: this.keywords.map(keyword => keyword.trim()),
      rects: this.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        id: this.form.value.includeGlobally ? this.form.value.id : (this.form.value.id || text),
        idHyperlink: idHyperlink || '',
        idType: idType || '',
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
