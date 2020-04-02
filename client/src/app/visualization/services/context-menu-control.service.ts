import { Injectable, OnDestroy } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';
import { Subject, Observable, race, timer, Subscription } from 'rxjs';
import { mapTo, first, takeUntil } from 'rxjs/operators';

@Injectable()
export class ContextMenuControlService extends TooltipControlService implements OnDestroy {
    private delayGroupByRelSource = new Subject<boolean>();
    private interruptGroupByRelSource = new Subject<boolean>();
    private showGroupByRelResultSource = new Subject<boolean>();

    private delayGroupByRelSourceSubscription: Subscription;

    delayGroupByRel$: Observable<boolean>;
    interruptGroupByRel$: Observable<boolean>;
    showGroupByRelResult$: Observable<boolean>;

    constructor() {
        super();

        this.delayGroupByRel$ = this.delayGroupByRelSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
        this.interruptGroupByRel$ = this.interruptGroupByRelSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
        this.showGroupByRelResult$ = this.showGroupByRelResultSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));

        this.delayGroupByRelSourceSubscription = this.delayGroupByRelSource.subscribe(() => {
            const example = race(
                this.interruptGroupByRelSource.pipe(mapTo(false)),
                timer(200).pipe(mapTo(true)),
            ).pipe(first());
            example.subscribe(val => this.showGroupByRelResultSource.next(val));
        });
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.delayGroupByRelSourceSubscription.unsubscribe();
    }

    delayGroupByRel() {
        this.delayGroupByRelSource.next(true);
    }

    interruptGroupByRel() {
        this.interruptGroupByRelSource.next(true);
    }
}
