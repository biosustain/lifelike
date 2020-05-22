import { Component, Inject } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { DrawingUploadPayload } from 'app/interfaces/drawing.interface';

import {
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';

@Component({
    selector: 'app-upload-project-dialog',
    templateUrl: './upload-project-dialog.component.html',
    styleUrls: ['./upload-project-dialog.component.scss']
})
export class UploadProjectDialogComponent {

    payload: File[];
    pickedFileName: string;

    form: FormGroup = new FormGroup({
        label: new FormControl('', Validators.required),
        description: new FormControl(''),
    });

    constructor(
        public dialogRef: MatDialogRef<UploadProjectDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.payload = this.data.payload;
    }

    closeDialog(): void {
        this.dialogRef.close();
    }

    onFilesPick(fileList: FileList) {
        this.payload = Array.from(fileList);
        this.pickedFileName = fileList.length ? fileList[0].name : '';
    }

    onSubmit(): void {
        if (this.form.controls.label.valid) {
            this.dialogRef.close({
                label: this.form.get('label').value,
                files: this.payload,
                filename: this.pickedFileName,
                description: this.form.get('description').value,
            } as DrawingUploadPayload);
        } else {
            this.form.controls.label.setErrors({required: true});
        }
    }
}
