import { ElementRef, Injectable, NgZone, OnDestroy } from '@angular/core';

import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { fromEventCapture } from 'app/shared/rxjs/from-event-capture';

/**
 * As of the time beeing, EventManagerService is used to redirect certain events from drawing tool
 * to graph view. This is done by listenting for events in capture phase on drawing tool
 * and then calling appropriate method on canvasGraphView. This might or might not stop event propagation.
 * In principle, the event handling is affected so graph view might intercept drawing tool events.
 * Event handling:
 * - event is captured on drawing tool
 * - event is fired on GraphView
 * - if event propagation is not stopped, event continues it's capture phase towards internal elements
 */
@Injectable()
export class EventManagerService implements OnDestroy {
  constructor(
    // ElementRef can be only injecvted to service declared in component providers
    private readonly elementRef: ElementRef // drawing tool element
  ) {}
  private readonly destroy$ = new Subject();

  registerGraphView(canvasGraphView: CanvasGraphView) {
    NgZone.assertNotInAngularZone(); // canvas events are handled outside angular
    // In capture phase take all keydown events of map and first try to run them against canvas
    // This is done to catch ctrl+d, which might be pressed when map is not focused.
    const drawingToolElement = this.elementRef.nativeElement;
    drawingToolElement.tabIndex = 0; // for drawing tool to be capturing keydown events
    fromEventCapture<KeyboardEvent>(drawingToolElement, 'keydown')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => canvasGraphView.canvasKeyDown(event));
    // We could redirect paste position, however current paste mechanism is based on canvas hover position.
    // Should we be pasting in the middle of the canvas?
    // fromEventCapture<ClipboardEvent>(this.elementRef.nativeElement, 'paste').subscribe(
    //   (event) => {
    //     try {
    //       JSON.parse(event.clipboardData.getData('text/plain'));
    //       canvasGraphView.documentPaste(event);
    //     } catch (e) {
    //       // if not valid json do not redirect to map
    //     }
    //   }
    // );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
