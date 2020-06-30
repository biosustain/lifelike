import { Component, OnInit } from '@angular/core';
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
export class AddContentDialogComponent implements OnInit {
  @Input() mode: string = 'dir'

  @Input() payload: UploadPayload;

  form: FormGroup = new FormGroup({
    directoryId: new FormControl(),
    // map
    label: new FormControl('', Validators.required),
    description: new FormControl(),
    // subDir
    dirname: new FormControl('', Validators.required),
    // pdf
    filename: new FormControl('', Validators.required)
  });

  isInvalid = false;

  subscription: Subscription;

  pickedFileName: string;

  // Used to disable the the submit in the original component .. 
  // [disabled]="forbidUpload"
  forbidUpload = true;

  constructor(
    public activeModal: NgbActiveModal
  ) {}

  ngOnInit() {
    this.subscription = this.form.valueChanges.subscribe(
      resp => this.isInvalid = false
    )
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  doNothing() {
    this.activeModal.dismiss()
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
      case 'pdf':
        if (!this.forbidUpload) {
          this.payload.filename = this.form.get('filename').value;
          this.activeModal.close(true);
        }
      break;
      default:
        break;
    }
  }

  /** Called upon picking a file from the Browse button */
  onFilesPick(fileList: FileList) {
    this.payload.files = this.transformFileList(fileList);
    this.pickedFileName = fileList.length ? fileList[0].name : '';
    this.form.get('filename').setValue(this.pickedFileName);
    this.validatePayload();
  }

  /** Validates if the Upload button should be enabled or disabled */
  validatePayload() {
    this.payload.type = UploadType.Files;
    const filesIsOk = this.payload.files && this.payload.files.length > 0;

    this.forbidUpload = !(filesIsOk);
  }

  /** 
   * Transforms a FileList to a File[]
   * Not sure why, but I can't pass a FileList back to the parent component
   */
  private transformFileList(fileList: FileList): File[] {
    const files: File[] = [];
    for (let i = 0; i < fileList.length; ++i) {
      files.push(fileList.item(i));
    }
    return files;
  }
}
