import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';
import { Subject, Observable, race, interval } from 'rxjs';
import { mapTo, first } from 'rxjs/operators';

@Injectable()
export class ContextMenuControlService extends TooltipControlService {
    delayGroupByRelSource = new Subject<boolean>();
    interruptGroupByRelSource = new Subject<boolean>();
    showGroupByRelResultSource = new Subject<boolean>();

    delayGroupByRel$: Observable<boolean>;
    interruptGroupByRel$: Observable<boolean>;
    showGroupByRelResult$: Observable<boolean>;

    constructor() {
        super();

        this.delayGroupByRel$ = this.delayGroupByRelSource.asObservable();
        this.interruptGroupByRel$ = this.interruptGroupByRelSource.asObservable();
        this.showGroupByRelResult$ = this.showGroupByRelResultSource.asObservable();

        this.delayGroupByRel$.subscribe(() => {
            const example = race(
                this.interruptGroupByRelSource.pipe(mapTo(false)),
                interval(200).pipe(mapTo(true)),
            ).pipe(first());
            example.subscribe(val => this.showGroupByRelResultSource.next(val));
        });
    }

    delayGroupByRel() {
        this.delayGroupByRelSource.next(true);
    }

    interruptGroupByRel() {
        this.interruptGroupByRelSource.next(true);
    }
}
