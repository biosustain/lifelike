import { Component, Input } from '@angular/core';
import { CommonFormDialogComponent } from '../../../../shared/components/dialog/common-form-dialog.component';
import { Hyperlink, Source } from '../../../services/interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../../shared/services/message-dialog.service';
import { potentiallyInternalUrl } from '../../../../shared/validators';

@Component({
  selector: 'app-link-edit-dialog',
  templateUrl: './link-edit-dialog.component.html',
})
export class LinkEditDialogComponent extends CommonFormDialogComponent<Source | Hyperlink> {

  @Input() title = 'Edit Link';

  private _link: Source | Hyperlink;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    domain: new FormControl('', Validators.required),
    url: new FormControl('', [
      Validators.required,
      potentiallyInternalUrl,
    ]),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get link(): Source | Hyperlink {
    return this._link;
  }

  set link(value: Source | Hyperlink) {
    this._link = value;
    this.form.patchValue(value);
  }

  getValue(): Source {
    const value = this.form.value;
    for (const key of Object.keys(value)) {
      this.link[key] = value[key];
    }
    return this.link;
  }

}
