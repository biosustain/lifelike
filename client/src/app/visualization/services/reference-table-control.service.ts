import { Injectable, OnDestroy } from '@angular/core';

import { Subject, Observable, race, timer, Subscription } from 'rxjs';
import { mapTo, switchMap, takeUntil } from 'rxjs/operators';

import { GetReferenceTableDataResult, DuplicateNodeEdgePair } from 'app/interfaces';
import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

import { VisualizationService } from './visualization.service';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService implements OnDestroy {
    private delayReferenceTableSource = new Subject<boolean>();
    private interruptReferenceTableSource = new Subject<boolean>();
    private showReferenceTableResultSource = new Subject<boolean>();
    private referenceTableRowDataSource = new Subject<GetReferenceTableDataResult>();

    private delayReferenceTableSubscription: Subscription;

    interruptReferenceTable$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;
    referenceTableRowData$: Observable<GetReferenceTableDataResult>;

    constructor(
        private visService: VisualizationService,
    ) {
        super();

        this.interruptReferenceTable$ = this.interruptReferenceTableSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
        this.referenceTableRowData$ = this.referenceTableRowDataSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));

        this.delayReferenceTableSubscription = this.delayReferenceTableSource.pipe(
            switchMap(() =>
                race(
                    this.interruptReferenceTableSource.pipe(mapTo(false)),
                    timer(500).pipe(mapTo(true)),
                )
            )
        ).subscribe(val => this.showReferenceTableResultSource.next(val));
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.delayReferenceTableSubscription.unsubscribe();
    }

    delayReferenceTable() {
        this.delayReferenceTableSource.next(true);
    }

    interruptReferenceTable() {
        this.interruptReferenceTableSource.next(true);
    }

    getReferenceTableData(nodeEdgePair: DuplicateNodeEdgePair[]) {
        this.visService.getReferenceTableData(nodeEdgePair).subscribe(result => this.referenceTableRowDataSource.next(result));
    }
}
