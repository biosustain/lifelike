import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Input } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';

@Component({
  selector: 'app-add-content-dialog',
  templateUrl: './add-content-dialog.component.html',
  styleUrls: ['./add-content-dialog.component.scss']
})
export class AddContentDialogComponent implements OnInit, OnDestroy {
  @Input() mode = 'dir';

  @Input() payload: UploadPayload;

  form: FormGroup = new FormGroup({
    directoryId: new FormControl(),
    // map
    label: new FormControl('', Validators.required),
    description: new FormControl(),
    // subDir
    dirname: new FormControl('', Validators.required),
  });

  isInvalid = false;

  subscription: Subscription;

  constructor(
    public activeModal: NgbActiveModal
  ) {}

  ngOnInit() {
    this.subscription = this.form.valueChanges.subscribe(
      resp => this.isInvalid = false
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  doNothing() {
    this.activeModal.dismiss();
  }

  submit() {
    switch (this.mode) {
      case 'dir':
        // Check if valid
        const dirnameCtrl = this.form.get('dirname');
        if (!dirnameCtrl.valid) {
          this.isInvalid = true;
        } else {
          const {
            dirname
          } = this.form.value;
          this.activeModal.close({
            dirname
          });
        }
        break;
      case 'map':
        // Check if valid
        const labelCtrl = this.form.get('label');
        if (!labelCtrl.valid) {
          this.isInvalid = true;
        } else {
          const {
            label,
            description
          } = this.form.value;
          this.activeModal.close({
            label,
            description
          });
        }
        break;
      default:
        break;
    }
  }
}
