import { Injectable, OnDestroy } from '@angular/core';

import { Subject, Observable, race, timer, Subscription } from 'rxjs';
import { mapTo, switchMap, first, map } from 'rxjs/operators';

import { GetReferenceTableDataResult, DuplicateNodeEdgePair } from 'app/interfaces';
import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

import { VisualizationService } from './visualization.service';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService implements OnDestroy {
    delayReferenceTableSource = new Subject<boolean>();
    interruptReferenceTableSource = new Subject<boolean>();
    showReferenceTableResultSource = new Subject<boolean>();

    referenceTableRowDataSource = new Subject<GetReferenceTableDataResult>();

    delayReferenceTable$: Observable<boolean>;
    interruptReferenceTable$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;

    referenceTableRowData$: Observable<GetReferenceTableDataResult>;

    delayReferenceTableSubscription: Subscription;

    constructor(
        private visService: VisualizationService,
    ) {
        super();

        this.delayReferenceTable$ = this.delayReferenceTableSource.asObservable();
        this.interruptReferenceTable$ = this.interruptReferenceTableSource.asObservable();
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable();
        this.referenceTableRowData$ = this.referenceTableRowDataSource.asObservable();

        this.delayReferenceTableSubscription = this.delayReferenceTable$.pipe(
            switchMap(() =>
                race(
                    this.interruptReferenceTableSource.pipe(mapTo(false)),
                    timer(500).pipe(mapTo(true)),
                )
            )
        ).subscribe(val => this.showReferenceTableResultSource.next(val));
    }

    ngOnDestroy() {
        this.delayReferenceTableSource.complete();
        this.interruptReferenceTableSource.complete();
        this.showReferenceTableResultSource.complete();

        this.delayReferenceTableSubscription.unsubscribe();
    }

    delayReferenceTable() {
        this.delayReferenceTableSource.next(true);
    }

    interruptReferenceTable() {
        this.interruptReferenceTableSource.next(true);
    }

    getReferenceTableData(nodeEdgePair: DuplicateNodeEdgePair[]) {
        this.visService.getReferenceTableData(nodeEdgePair).pipe(
            first()
        ).subscribe(result => this.referenceTableRowDataSource.next(result));
    }
}
