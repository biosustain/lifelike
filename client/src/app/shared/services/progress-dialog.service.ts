import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { ProgressDialogComponent } from '../components/progress-dialog/progress-dialog.component';
import { Observable } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';

export interface ProgressDialogArguments {
  title: string;
  progressObservable: Observable<Progress>;
}

@Injectable({
  providedIn: 'root',
})
export class ProgressDialog {
  constructor(
    public dialog: MatDialog
  ) {
  }

  display(args: ProgressDialogArguments) {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.width = '400px';
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {
      title: args.title,
      progressObservable: args.progressObservable,
    };

    return this.dialog.open(ProgressDialogComponent, dialogConfig);
  }
}
