import { CdkDragMove, CdkDragRelease, CdkDragStart } from '@angular/cdk/drag-drop';
import { NgZone } from '@angular/core';

import { toPairs } from 'lodash-es';
import { animationFrameScheduler, fromEvent, interval, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, first, map, scan, throttle } from 'rxjs/operators';

import { inDevModeTap } from '../rxjs/debug';

export class DragImage {
  constructor(readonly image: HTMLElement, readonly x: number, readonly y: number) {}

  addDataTransferData(dataTransfer: DataTransfer) {
    document.body.appendChild(this.image);
    dataTransfer.setDragImage(this.image, this.x, this.y);
    setTimeout(() => this.image.remove(), 500);
  }
}

export class CdkNativeDragItegration<T = any> {
  constructor(private dragData$: Observable<Record<string, string>>, private ngZone: NgZone) {}

  trackTarget$ = fromEvent(document, 'mousemove').pipe(
    inDevModeTap(NgZone.assertNotInAngularZone),
    throttle(() => interval(0, animationFrameScheduler), { leading: true, trailing: true }),
    map((event: MouseEvent) => document.elementFromPoint(event.clientX, event.clientY)),
    distinctUntilChanged(),
    scan((prevTarget, currTarget) => {
      if (prevTarget) {
        const synthDragLeaveEvent = new DragEvent('dragleave', { bubbles: true });
        prevTarget.dispatchEvent(synthDragLeaveEvent);
      }
      const synthDragEnterEvent = new DragEvent('dragenter', { bubbles: true });
      currTarget.dispatchEvent(synthDragEnterEvent);
      return currTarget;
    })
  );
  trackTargetSubscription: Subscription;

  lastDragTarget: Element = null;

  cdkDragStarted($event: CdkDragStart<T>) {
    this.ngZone.runOutsideAngular(() => {
      this.trackTargetSubscription = this.trackTarget$.subscribe(
        (target) => (this.lastDragTarget = target),
        (error) => console.error(error),
        () => (this.lastDragTarget = null)
      );
    });
  }

  cdkDragMoved($event: CdkDragMove) {
    throw new Error(
      'CdkDragMoved observable runs in Angular zone, which comes with hefty perfomance drawbacks. Do not use it!'
    );
  }

  cdkDragReleased($event: CdkDragRelease<T>) {
    const dropTarget = this.lastDragTarget;
    this.trackTargetSubscription?.unsubscribe();
    if (dropTarget) {
      const synthDropEvent = new DragEvent('drop', {
        dataTransfer: new DataTransfer(),
        bubbles: true,
      });

      return this.dragData$
        .pipe(
          first(),
          map((dragData) => {
            toPairs(dragData).forEach((args) => synthDropEvent.dataTransfer.setData(...args));
            return dropTarget.dispatchEvent(synthDropEvent);
          })
        )
        .toPromise();
    }
  }
}
