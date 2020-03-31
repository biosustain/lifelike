import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ExpandNodeResult } from 'app/interfaces';

@Component({
    selector: 'app-auto-cluster-dialog',
    templateUrl: './auto-cluster-dialog.component.html',
    styleUrls: ['./auto-cluster-dialog.component.scss']
})
export class AutoClusterDialogComponent implements OnInit {

    constructor(
        public dialogRef: MatDialogRef<AutoClusterDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ExpandNodeResult,
    ) {}

    dontAskAgain: boolean;

    ngOnInit() {}

    onNoClick() {
        this.dialogRef.close({
            clusterExpandedNodes: false,
            data: this.data,
            dontAskAgain: this.dontAskAgain
        });
    }

    onOkClick() {
        this.dialogRef.close({
            clusterExpandedNodes: true,
            data: this.data,
            dontAskAgain: this.dontAskAgain
        });
    }
}
