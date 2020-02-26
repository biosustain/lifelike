import { Injectable, OnDestroy } from '@angular/core';

import { Subject, Observable, race, timer, Subscription } from 'rxjs';
import { mapTo, switchMap } from 'rxjs/operators';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';


@Injectable()
export class ReferenceTableControlService extends TooltipControlService implements OnDestroy {
    delayReferenceTableSource = new Subject<boolean>();
    interruptReferenceTableSource = new Subject<boolean>();
    showReferenceTableResultSource = new Subject<boolean>();

    delayReferenceTable$: Observable<boolean>;
    interruptReferenceTable$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;


    delayReferenceTableSubscription: Subscription;

    constructor() {
        super();

        this.delayReferenceTable$ = this.delayReferenceTableSource.asObservable();
        this.interruptReferenceTable$ = this.interruptReferenceTableSource.asObservable();
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable();

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
    }

    delayReferenceTable() {
        this.delayReferenceTableSource.next(true);
    }

    interruptReferenceTable() {
        this.interruptReferenceTableSource.next(true);
    }
}
