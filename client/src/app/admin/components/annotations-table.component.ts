import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { GlobalAnnotationService } from 'app/shared/services/global-annotation-service';
import { GlobalAnnotation } from 'app/interfaces/annotation';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { tap } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { downloader } from 'app/shared/utils';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { HttpEventType } from '@angular/common/http';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import {
  PaginatedRequestOptions,
  ResultList,
  StandardRequestOptions,
} from 'app/shared/schemas/common';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { FilesystemService } from '../../file-browser/services/filesystem.service';

@Component({
    selector: 'app-annotations-table',
    templateUrl: './annotations-table.component.html',
})
export class AnnotationTableComponent implements OnInit, OnDestroy {

    collectionSize = 0;
    currentPage = 1;
    pageSize = 100;
    selection = new SelectionModel(true, []);

    private readonly defaultLocator: StandardRequestOptions = {
        limit: 100,
        page: 1,
        sort: '',
    };

    readonly filterForm: FormGroup = new FormGroup({
        q: new FormControl(''),
        limit: new FormControl(100),
    });

    readonly loadTask: BackgroundTask<PaginatedRequestOptions, ResultList<GlobalAnnotation>> = new BackgroundTask(
        (locator: PaginatedRequestOptions) => this.globalAnnotationService.getAnnotations(locator),
    );

    locator: StandardRequestOptions = {
        ...this.defaultLocator,
    };

    readonly results = new CollectionModel<GlobalAnnotation>([], {
        multipleSelection: true,
    });

    protected subscriptions = new Subscription();

    readonly headers: string[] = [
        'Text',
        'Case Insensitive',
        'Type',
        'Entity Type',
        'Entity ID',
        'File Reference',
        'File Deleted',
        'Added By',
        'Reason',
        'Comment',
        'Date Added',
        'Open File'
    ];

    constructor(
        private globalAnnotationService: GlobalAnnotationService,
        private readonly route: ActivatedRoute,
        private readonly errorHandler: ErrorHandler,
        private readonly progressDialog: ProgressDialog,
        private readonly filesystemService: FilesystemService,
        private readonly filesystemObjectActions: FilesystemObjectActions,
    ) {}

    ngOnInit() {
        this.subscriptions.add(this.loadTask.results$.subscribe(({result: annotations}) => {
            this.collectionSize = annotations.total;
            this.results.replace(annotations.results);
        }));

        this.subscriptions.add(this.route.queryParams.pipe(
            tap((params) => {
                this.locator = {
                    ...this.defaultLocator,
                    ...params,
                    page: params.hasOwnProperty('page') ? parseInt(params.page, 10) : this.defaultLocator.page,
                    limit: params.hasOwnProperty('limit') ? parseInt(params.limit, 10) : this.defaultLocator.limit,
                };
                this.filterForm.patchValue(this.locator);
                this.refresh();
            }),
        ).subscribe());
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    goToPage(page: number) {
        this.currentPage = page;
        this.locator = {...this.locator, page};
        this.subscriptions.add(this.globalAnnotationService.getAnnotations(this.locator).pipe().subscribe(
            (({results: annotations}) => {
                this.results.replace(annotations);
            })
        ));
    }

    isAllSelected(): boolean {
        if (!this.selection.selected.length) {
            return false;
        }
    }

    toggleAllSelected(): void {
        if (this.isAllSelected()) {

        }
    }

    refresh() {
        this.loadTask.update(this.locator);
    }

    openNewWindow(fileHashId: string) {
        this.filesystemService.get(fileHashId).pipe().subscribe(fileObject =>
            this.filesystemObjectActions.openNewWindow(fileObject));
    }

    deleteAnnotation(objects: readonly GlobalAnnotation[]) {
        const pids = objects.map((r: GlobalAnnotation) => r.globalId);
        this.subscriptions.add(this.globalAnnotationService.deleteAnnotations(pids).pipe().subscribe());
        this.refresh();
    }

    exportGlobalExclusions() {
        const progressObservable = new BehaviorSubject<Progress>(new Progress({
            status: 'Preparing file for download...'
        }));
        const progressDialogRef = this.progressDialog.display({
            title: `Exporting global exclusions`,
            progressObservable,
        });

        this.subscriptions.add(this.globalAnnotationService.exportGlobalExclusions().pipe(
            this.errorHandler.create({label: 'Export global exclusion'})
        ).subscribe(event => {
            if (event.type === HttpEventType.DownloadProgress) {
                if (event.loaded >= event.total) {
                    progressObservable.next(new Progress({
                        mode: ProgressMode.Buffer,
                        status: '...',
                        value: event.loaded / event.total,
                    }));
                } else {
                    progressObservable.next(new Progress({
                        mode: ProgressMode.Determinate,
                        status: '...',
                        value: event.loaded / event.total,
                    }));
                }
            } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                const filename = event.headers.get('content-disposition').split('=')[1];
                downloader(event.body, 'application/vnd.ms-excel', filename);
            }
        }));
    }

    exportGlobalInclusions() {
        const progressObservable = new BehaviorSubject<Progress>(new Progress({
            status: 'Preparing file for download...'
        }));
        const progressDialogRef = this.progressDialog.display({
            title: `Exporting global inclusions`,
            progressObservable,
        });

        this.subscriptions.add(this.globalAnnotationService.exportGlobalInclusions().pipe(
            this.errorHandler.create({label: 'Export global inclusion'})
        ).subscribe(event => {
            if (event.type === HttpEventType.DownloadProgress) {
                if (event.loaded >= event.total) {
                    progressObservable.next(new Progress({
                        mode: ProgressMode.Buffer,
                        status: '...',
                        value: event.loaded / event.total,
                    }));
                } else {
                    progressObservable.next(new Progress({
                        mode: ProgressMode.Determinate,
                        status: '...',
                        value: event.loaded / event.total,
                    }));
                }
            } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                const filename = event.headers.get('content-disposition').split('=')[1];
                downloader(event.body, 'application/vnd.ms-excel', filename);
            }
        }));
    }
}
