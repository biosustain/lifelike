import { Component, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PdfFile } from 'app/interfaces/pdf-files.interface';

@Component({
  selector: 'app-file-selection-dialog',
  templateUrl: './file-selection-dialog.component.html',
})
export class FileSelectionDialogComponent {
  @ViewChild('fileList', {static: false}) fileList;

  constructor(private dialogRef: MatDialogRef<FileSelectionDialogComponent>,
              @Inject(MAT_DIALOG_DATA) data) {
  }

  refresh() {
    this.fileList.refresh();
  }

  select(file: PdfFile) {
    this.dialogRef.close(file);
  }
}
