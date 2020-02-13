import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';
import { Subject, Observable, race, interval } from 'rxjs';
import { mapTo, first } from 'rxjs/operators';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService {
    delayReferenceTableSource = new Subject<boolean>();
    interruptReferenceTableSource = new Subject<boolean>();
    showReferenceTableResultSource = new Subject<boolean>();

    delayReferenceTable$: Observable<boolean>;
    interruptReferenceTable$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;

    constructor() {
        super();

        this.delayReferenceTable$ = this.delayReferenceTableSource.asObservable();
        this.interruptReferenceTable$ = this.interruptReferenceTableSource.asObservable();
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable();

        this.delayReferenceTable$.subscribe(() => {
            const example = race(
                this.interruptReferenceTableSource.pipe(mapTo(false)),
                interval(500).pipe(mapTo(true)),
            ).pipe(first());
            example.subscribe(val => this.showReferenceTableResultSource.next(val));
        });
    }

    delayReferenceTable() {
        this.delayReferenceTableSource.next(true);
    }

    interruptReferenceTable() {
        this.interruptReferenceTableSource.next(true);
    }
}
