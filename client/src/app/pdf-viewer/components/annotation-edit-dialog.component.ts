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

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
})
export class AnnotationEditDialogComponent extends CommonFormDialogComponent {
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[];
  @Input() set allText(allText: string) {
    this.allTextOptions = this.getTextOptions(allText);
    this.form.patchValue({
      text: this.allTextOptions[0]
    });
    if (this.allTextOptions.length === 1) {
      this.form.controls.text.disable();
    }
  }
  linkTemplates: Hyperlink[] = cloneDeep(SEARCH_LINKS);
  allTextOptions: string[];

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl('', Validators.required),
    entityType: new FormControl(this.entityTypeChoices[0].name, Validators.required),
    id: new FormControl(''),
    links: new FormArray([]),
    includeGlobally: new FormControl(false),
  });
  readonly links = this.form.get('links') as FormArray;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
    const linksArray = this.form.get('links') as FormArray;
    for (const link of this.linkTemplates) {
      linksArray.push(new FormControl('', url));
    }
  }

  getValue(): Annotation {
    const text = this.form.getRawValue().text;
    const links = {};
    this.form.value.links.forEach((value, i) => {
      const domain = this.linkTemplates[i].domain.toLowerCase();
      links[domain] = value || this.substituteLink(this.linkTemplates[i].url, text);
    });

    let primaryLink = '';
    for (const link of this.form.value.links) {
      if (link.length) {
        primaryLink = link;
      }
    }

    return {
      pageNumber: this.pageNumber,
      keywords: this.keywords.map(keyword => keyword.trim()),
      rects: this.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        id: this.form.value.id,
        type: this.form.value.entityType,
        color: ENTITY_TYPE_MAP[this.form.value.entityType].color,
        links,
        isCustom: true,
        allText: text,
        primaryLink,
        includeGlobally: this.form.value.includeGlobally,
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

  getTextOptions(text: string) {
    // text = '(gene)' => textOptions = ['(gene)', 'gene)', '(gene', 'gene']
    text = text.trim();
    const textOptions = [text];
    const punctuation = '[.,\/#!$%\^&\*;:{}=\-_`~()]';
    let start = 0;
    while (punctuation.includes(text[start]) && start < text.length) {
      start++;
      textOptions.push(text.substring(start));
    }

    textOptions.forEach(textOption => {
      let end = textOption.length - 1;
      while (punctuation.includes(textOption[end]) && end > 0) {
        textOptions.push(textOption.substring(0, end));
        end--;
      }
    });
    return textOptions;
  }
}
