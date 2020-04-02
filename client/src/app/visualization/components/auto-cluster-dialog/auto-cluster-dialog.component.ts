import { Component, OnInit, Inject, EventEmitter } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ExpandNodeResult } from 'app/interfaces';

@Component({
    selector: 'app-auto-cluster-dialog',
    templateUrl: './auto-cluster-dialog.component.html',
    styleUrls: ['./auto-cluster-dialog.component.scss']
})
export class AutoClusterDialogComponent implements OnInit {
    clickedActionButton = new EventEmitter<boolean>();
    loadingClusters = false;
    dontAskAgain = false;

    constructor(
        public dialogRef: MatDialogRef<AutoClusterDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ExpandNodeResult,
    ) {}


    ngOnInit() {}

    onNoClick() {
        this.clickedActionButton.emit(false);
    }

    onOkClick() {
        this.clickedActionButton.emit(true);
        this.loadingClusters = true;
    }
}
