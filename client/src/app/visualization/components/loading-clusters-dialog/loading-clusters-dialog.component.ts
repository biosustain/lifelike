import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';

@Component({
    selector: 'app-loading-clusters-dialog',
    templateUrl: './loading-clusters-dialog.component.html',
    styleUrls: ['./loading-clusters-dialog.component.scss']
})
export class LoadingClustersDialogComponent {

    constructor(
        public dialogRef: MatDialogRef<LoadingClustersDialogComponent>,
    ) { }

    closeDialog() {
        this.dialogRef.close();
    }
}
