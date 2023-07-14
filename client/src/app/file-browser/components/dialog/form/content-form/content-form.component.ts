import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import {
  ControlContainer,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ValidationErrors,
} from '@angular/forms';

import { AbstractNestedForm } from '../abstract-nested-form';

@Component({
  selector: 'app-content-form',
  templateUrl: './content-form.component.html',
  styleUrls: ['./content-form.component.scss'],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
})
export class ContentFormComponent extends AbstractNestedForm implements OnInit {
  constructor(protected parentFormDirective: FormGroupDirective) {
    super(parentFormDirective);
  }
  @Input() promptUpload = false;
  @Input() promptParent = false;

  @ViewChild('fileInput', { static: false })
  protected readonly fileInputElement: ElementRef;

  readonly formControl = new FormGroup(
    {
      contentSource: new FormControl('contentValue'),
      contentValue: new FormControl(null),
      contentUrl: new FormControl(''),
    },
    (group: FormGroup): ValidationErrors | null => {
      const contentValueControl = group.get('contentValue');
      const contentUrlControl = group.get('contentUrl');

      if (group.get('contentSource').value === 'contentValue') {
        contentUrlControl.setErrors(null);
        if (!contentValueControl.value) {
          contentValueControl.setErrors({
            required: {},
          });
        }
      } else if (group.get('contentSource').value === 'contentUrl') {
        contentValueControl.setErrors(null);
        if (!contentUrlControl.value) {
          contentUrlControl.setErrors({
            required: {},
          });
        }
      }
      return null;
    }
  );
  readonly name = 'contentForm';

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }

  ngOnInit(): void {
    super.ngOnInit();
  }
}
