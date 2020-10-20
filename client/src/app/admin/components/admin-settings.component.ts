import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, throwError } from 'rxjs';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { StorageService } from 'app/shared/services/storage.service';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

@Component({
    selector: 'app-admin-settings-view',
    templateUrl: 'admin-settings.component.html',
})
export class AdminSettingsComponent {

    readonly form: FormGroup = new FormGroup({
        files: new FormControl(''),
    })

    constructor(
        private readonly progressDialog: ProgressDialog,
        private readonly errorHandler: ErrorHandler,
        private readonly snackBar: MatSnackBar,
        private storage: StorageService,
    ) {}

    fileChanged(event) {
        if (event.target.files.length) {
            const file = event.target.files[0];
            this.form.get('files').setValue([file]);
        } else {
            this.form.get('files').setValue(null);
        }
    }

    submit() {
        const progressObservable = new BehaviorSubject<Progress>(new Progress({
            status: 'Uploading user manual...',
        }))
        const progressDialogRef = this.progressDialog.display({
            title: 'Saving manual as ***ARANGO_DB_NAME***-user-manual.pdf...',
            progressObservable,
        })
        const data = {...this.form.value};
        const file: File = data.files[0];
        this.storage.uploadUserManual(file).pipe(
            this.errorHandler.create()
        ).subscribe(event => {
            if (event.type === HttpEventType.UploadProgress) {
                progressObservable.next(new Progress({
                    mode: ProgressMode.Determinate,
                    status: 'Uploading file...',
                    value: event.loaded / event.total,
                }));
            } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                this.snackBar.open(`User manual uploaded`, 'Close', {duration: 5000});
            }
        },
        err => {
            progressDialogRef.close();
            return throwError(err);
        });
    }
}
