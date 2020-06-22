import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-exclusion-panel',
  templateUrl: './exclusion-panel.component.html',
  styleUrls: ['./exclusion-panel.component.scss']
})
export class ExclusionPanelComponent {
  reasons = [
    'Not an entity',
    'Wrong annotation type',
    'Other'
  ];
  selectedReason = this.reasons[0];
  comment = '';

  constructor(private dialogRef: MatDialogRef<ExclusionPanelComponent>) { }

  addAnnotationExclusion() {
    this.dialogRef.close({
      reason: this.selectedReason,
      comment: this.comment
    });
  }

}
