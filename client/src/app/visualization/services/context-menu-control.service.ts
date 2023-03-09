import { Injectable, OnDestroy } from "@angular/core";

import { Observable, race, Subject, Subscription, timer } from "rxjs";
import { first, mapTo, takeUntil } from "rxjs/operators";

import { TooltipControlService } from "app/shared/services/tooltip-control-service";

@Injectable()
export class ContextMenuControlService extends TooltipControlService implements OnDestroy {
  delayGroupByRel$: Observable<boolean>;
  interruptGroupByRel$: Observable<boolean>;
  showGroupByRelResult$: Observable<boolean>;
  delayPullOutNode$: Observable<boolean>;
  interruptPullOutNode$: Observable<boolean>;
  showPullOutNodeResult$: Observable<boolean>;
  // "Group by Relationship" submenu controls
  private delayGroupByRelSource = new Subject<boolean>();
  private interruptGroupByRelSource = new Subject<boolean>();
  private showGroupByRelResultSource = new Subject<boolean>();
  private delayGroupByRelSourceSubscription: Subscription;
  // "Pull Out Node" submenu controls
  private delayPullOutNodeSource = new Subject<boolean>();
  private interruptPullOutNodeSource = new Subject<boolean>();
  private showPullOutNodeResultSource = new Subject<boolean>();
  private delayPullOutNodeSourceSubscription: Subscription;

  constructor() {
    super();

    // Setup "Group by Relationshp" observables
    this.delayGroupByRel$ = this.delayGroupByRelSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));
    this.interruptGroupByRel$ = this.interruptGroupByRelSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));
    this.showGroupByRelResult$ = this.showGroupByRelResultSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));

    this.delayGroupByRelSourceSubscription = this.delayGroupByRelSource.subscribe(() => {
      const example = race(
        this.interruptGroupByRelSource.pipe(mapTo(false)),
        timer(200).pipe(mapTo(true))
      ).pipe(first());
      example.subscribe((val) => this.showGroupByRelResultSource.next(val));
    });

    // Setup "Pull Out Node" observables
    this.delayPullOutNode$ = this.delayPullOutNodeSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));
    this.interruptPullOutNode$ = this.interruptPullOutNodeSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));
    this.showPullOutNodeResult$ = this.showPullOutNodeResultSource
      .asObservable()
      .pipe(takeUntil(this.completeSubjectsSource));

    this.delayPullOutNodeSourceSubscription = this.delayPullOutNodeSource.subscribe(() => {
      const example = race(
        this.interruptPullOutNodeSource.pipe(mapTo(false)),
        timer(200).pipe(mapTo(true))
      ).pipe(first());
      example.subscribe((val) => this.showPullOutNodeResultSource.next(val));
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.delayGroupByRelSourceSubscription.unsubscribe();
    this.delayPullOutNodeSourceSubscription.unsubscribe();
  }

  delayGroupByRel() {
    this.delayGroupByRelSource.next(true);
  }

  interruptGroupByRel() {
    this.interruptGroupByRelSource.next(true);
  }

  delayPullOutNode() {
    this.delayPullOutNodeSource.next(true);
  }

  interruptPullOutNode() {
    this.interruptPullOutNodeSource.next(true);
  }
}
