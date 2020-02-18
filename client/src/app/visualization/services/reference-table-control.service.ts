import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';
import { Subject, Observable, race, interval } from 'rxjs';
import { mapTo, first } from 'rxjs/operators';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService {
    delayEdgeMenuSource = new Subject<boolean>();
    interruptEdgeMenuSource = new Subject<boolean>();
    showReferenceTableResultSource = new Subject<boolean>();

    delayEdgeMenu$: Observable<boolean>;
    interruptEdgeMenu$: Observable<boolean>;
    showReferenceTableResult$: Observable<boolean>;

    constructor() {
        super();

        this.delayEdgeMenu$ = this.delayEdgeMenuSource.asObservable();
        this.interruptEdgeMenu$ = this.interruptEdgeMenuSource.asObservable();
        this.showReferenceTableResult$ = this.showReferenceTableResultSource.asObservable();

        this.delayEdgeMenu$.subscribe(() => {
            const example = race(
                this.interruptEdgeMenuSource.pipe(mapTo(false)),
                interval(500).pipe(mapTo(true)),
            ).pipe(first());
            example.subscribe(val => this.showReferenceTableResultSource.next(val));
        });
    }

    delayEdgeMenu() {
        this.delayEdgeMenuSource.next(true);
    }

    // TODO: Should probably also interrupt if the user hovers out of the node table row
    interruptEdgeMenu() {
        this.interruptEdgeMenuSource.next(true);
    }
}
