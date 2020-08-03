import { Component, Input, OnChanges, ViewEncapsulation } from '@angular/core';
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
  @Input() text: string[];
  @Input() coords: number[];
  @Input() allText: string;
  linkTemplates: Hyperlink[] = cloneDeep(SEARCH_LINKS);

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    entityType: new FormControl('', Validators.required),
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
    const links = this.form.value.links.map((value, i) => {
      return [
        this.linkTemplates[i].domain,
        value.length ? value : this.substituteLink(this.linkTemplates[i].url, this.allText),
      ];
    });

    let primaryLink = '';
    for (const link of this.form.value.links) {
      if (link.length) {
        primaryLink = link;
      }
    }

    return {
      pageNumber: this.pageNumber,
      keywords: this.text.map(keyword => keyword.trim()),
      rects: this.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        type: this.form.value.entityType,
        color: ENTITY_TYPE_MAP[this.form.value.entityType].color,
        links,
        isCustom: true,
        allText: this.allText.trim(),
        primaryLink,
        includeGlobally: this.form.value.includeGlobally,
      },
    };
  }

  substituteLink(s: string, query: string) {
    return s.replace(/%s/, encodeURIComponent(query));
  }
}
