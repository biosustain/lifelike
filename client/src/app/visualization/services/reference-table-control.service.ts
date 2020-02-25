import { Injectable, OnDestroy } from '@angular/core';

import { Subject, Observable, race, timer, Subscription } from 'rxjs';
import { mapTo, switchMap } from 'rxjs/operators';

import { VisEdge, GetEdgeSnippetCountsResult } from 'app/interfaces';
import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

import { VisualizationService } from './visualization.service';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService implements OnDestroy {
    delayReferenceTableSource = new Subject<boolean>();
    interruptReferenceTableSource = new Subject<boolean>();
    showReferenceTableResultSource = new Subject<boolean>();

    delayEdgeMenuSource = new Subject<boolean>();
    interruptEdgeMenuSource = new Subject<boolean>();
    showEdgeMenuResultSource = new Subject<boolean>();

    associationCountForEdgesSource = new Subject<GetEdgeSnippetCountsResult>();

    delayReferenceTable$: Observable<boolean>;
    interruptReferenceTable$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;

    delayEdgeMenu$: Observable<boolean>;
    interruptEdgeMenu$: Observable<boolean>;
    showEdgeMenuResult$: Observable<boolean>;

    associationCountForEdges$: Observable<GetEdgeSnippetCountsResult>;

    delayReferenceTableSubscription: Subscription;
    delayEdgeMenuSubscription: Subscription;

    constructor(
        private visService: VisualizationService,
    ) {
        super();

        this.delayReferenceTable$ = this.delayReferenceTableSource.asObservable();
        this.interruptReferenceTable$ = this.interruptReferenceTableSource.asObservable();
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable();

        this.delayEdgeMenu$ = this.delayEdgeMenuSource.asObservable();
        this.interruptEdgeMenu$ = this.interruptEdgeMenuSource.asObservable();
        this.showEdgeMenuResult$ = this.showEdgeMenuResultSource.asObservable();

        this.associationCountForEdges$ = this.associationCountForEdgesSource.asObservable();

        this.delayReferenceTableSubscription = this.delayReferenceTable$.pipe(
            switchMap(() =>
                race(
                    this.interruptReferenceTableSource.pipe(mapTo(false)),
                    timer(500).pipe(mapTo(true)),
                )
            )
        ).subscribe(val => this.showReferenceTableResultSource.next(val));

        this.delayEdgeMenuSubscription = this.delayEdgeMenu$.pipe(
            switchMap(() =>
                race(
                    this.interruptEdgeMenuSource.pipe(mapTo(false)),
                    timer(500).pipe(mapTo(true)),
                )
            )
        ).subscribe(val => this.showEdgeMenuResultSource.next(val));
    }

    ngOnDestroy() {
        this.delayReferenceTableSource.complete();
        this.interruptReferenceTableSource.complete();
        this.showReferenceTableResultSource.complete();

        this.delayEdgeMenuSource.complete();
        this.interruptEdgeMenuSource.complete();
        this.showEdgeMenuResultSource.complete();

        this.delayReferenceTableSubscription.unsubscribe();
        this.delayEdgeMenuSubscription.unsubscribe();
    }

    delayReferenceTable() {
        this.delayReferenceTableSource.next(true);
    }

    interruptReferenceTable() {
        this.interruptReferenceTableSource.next(true);
    }

    delayEdgeMenu() {
        this.delayEdgeMenuSource.next(true);
    }

    interruptEdgeMenu() {
        this.interruptEdgeMenuSource.next(true);
    }

    getAssociationCountForEdges(edges: VisEdge[]) {
        this.visService.getSnippetCountForEdges(edges).subscribe(result => this.associationCountForEdgesSource.next(result));
    }
}
