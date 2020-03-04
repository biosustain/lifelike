import {Component, Inject, OnInit} from '@angular/core';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

export interface ProjectData {
  label: string,
  description: string
}

@Component({
  selector: 'app-delete-project-dialog',
  templateUrl: './delete-project-dialog.component.html',
  styleUrls: ['./delete-project-dialog.component.scss']
})
export class DeleteProjectDialogComponent implements OnInit {

  project: ProjectData;

  constructor(
    public dialogRef: MatDialogRef<DeleteProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectData
  ) {
    this.project = data;
  }

  ngOnInit() {

  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmitClick(): void {
    this.dialogRef.close({
      project: this.project,
      delete: true
    });
  }
}
