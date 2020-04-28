import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-export-modal',
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.scss']
})
export class ExportModalComponent implements OnInit {
  selected = 'pdf';
  constructor(
    private dialogRef: MatDialogRef<ExportModalComponent>) { }

  ngOnInit() {
  }

  download() {
    this.dialogRef.close(this.selected);
  }
}
