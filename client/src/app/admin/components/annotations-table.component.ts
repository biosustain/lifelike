import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { GlobalAnnotationService } from 'app/shared/services/global-annotation-service';
import { GlobalAnnotation, GlobalAnnotationRow } from 'app/interfaces/annotation';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { PaginatedRequestOptions, ResultList, StandardRequestOptions } from 'app/interfaces/shared.interface';
import { CollectionModal } from 'app/shared/utils/collection-modal';
import { tap, first } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';

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

    readonly results = new CollectionModal<GlobalAnnotation>([], {
        multipleSelection: true,
    });

    private loadTaskSubscription: Subscription;
    private routerParamSubscription: Subscription;

    readonly headers: string[] = [
        'Text',
        'Annotation Type',
        'Entity Type',
        'Annotation ID',
        'File Reference',
        'Added by',
        'Reason',
        'Comment',
        'Date Added',
    ];

    constructor(
        private globalAnnotationService: GlobalAnnotationService,
        private readonly route: ActivatedRoute,
    ) {}

    ngOnInit() {
        this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: annotations}) => {
            this.collectionSize = annotations.total;
            this.results.replace(annotations.results);
        });

        this.routerParamSubscription = this.route.queryParams.pipe(
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
        ).subscribe();
    }

    ngOnDestroy() {
        this.loadTaskSubscription.unsubscribe();
        this.routerParamSubscription.unsubscribe();
    }

    goToPage(page: number) {
        this.currentPage = page;
        this.locator = {...this.locator, page};
        this.globalAnnotationService.getAnnotations(this.locator).pipe(first()).subscribe(
            (({results: annotations}) => {
                this.results.replace(annotations);
            })
        );
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

    deleteAnnotation(objects: readonly GlobalAnnotationRow[]) {
        const pids = objects.map((r: GlobalAnnotationRow) => r.pid);
        this.globalAnnotationService.deleteAnnotations(pids).pipe(first()).subscribe();
        this.refresh();
    }
}
