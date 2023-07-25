import {
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy, OnInit,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

import { iif, merge, Observable, of, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, map, startWith, switchMap, tap } from 'rxjs/operators';

import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { DelegateResourceManager } from 'app/graph-viewer/utils/resource/resource-manager';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { isNotEmpty } from 'app/shared/utils';
import { CompoundAction } from 'app/graph-viewer/actions/actions';
import { fromRendererEvent } from 'app/shared/rxjs/from-renderer-event';
import { someInIterable } from 'app/shared/utils/types';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { MapImageProviderService } from '../services/map-image-provider.service';
import { GraphActionsService } from '../services/graph-actions.service';
import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';

@Directive({
  selector: 'canvas[appGraphView]',
})
export class GraphViewDirective implements OnDestroy, OnChanges, OnInit {
  constructor(
    private readonly canvasElem: ElementRef<HTMLCanvasElement>,
    private readonly mapImageProviderService: MapImageProviderService,
    private readonly dataTransferDataService: DataTransferDataService,
    private readonly graphActionsService: GraphActionsService,
    private readonly renderer: Renderer2,
    private readonly ngZone: NgZone,
    private readonly errorHandler: ErrorHandler,
  ) {
    ngZone.runOutsideAngular(() => {
      const style = new KnowledgeMapStyle(new DelegateResourceManager(mapImageProviderService));
      this.canvasGraphView = new CanvasGraphView(canvasElem.nativeElement as HTMLCanvasElement, {
        nodeRenderStyle: style,
        edgeRenderStyle: style,
        groupRenderStyle: style,
      });
    });
  }

  public canvasGraphView: CanvasGraphView;
  private dragAndDropSubscription: Subscription;

  @Input() disableDragAndDrop: boolean;

  private readonly dragAndDrop$ = merge(
    this.fromCanvasEvent<DragEvent>('dragenter').pipe(
      switchMap(dragStartEvent => {
        const dropEffect = dragStartEvent.dataTransfer && (
          someInIterable(
            dragStartEvent.dataTransfer.items as any as Iterable<DataTransferItem> ?? [],
            item => item.type.startsWith('image/'),
          ) || isNotEmpty(
            this.dataTransferDataService
              .extract(dragStartEvent.dataTransfer)
              .filter((item) => item.token === GRAPH_ENTITY_TOKEN),
          ) ? 'link' : null
        );
        return iif(
          () => dropEffect != null,
          // If needed this event onwards we overwrite the dropEffect in dragover event
          this.fromCanvasEvent<DragEvent>('dragover').pipe(
            startWith(dragStartEvent),
            tap(event => {
              event.dataTransfer.dropEffect = dropEffect;
              event.preventDefault();
            }),
          ),
          of(dragStartEvent),
        );
      }),
      map((event) => true /*drop area targeted*/),
    ),
    merge(
      this.fromCanvasEvent<DragEvent>('dragleave'),
      this.fromCanvasEvent<DragEvent>('drop').pipe(
        // Prevent default to avoid browser to open the dropped file
        tap((event) => event.preventDefault()),
        // Side effect to extract dropped data and schedule an action to add it to the graph
        tap((event) => {
          const hoverPosition = this.canvasGraphView.hoverPosition;
          if (hoverPosition != null) {
            const items = this.dataTransferDataService.extract(event.dataTransfer);
            if (isNotEmpty(items)) {
              this.canvasGraphView.selection.replace([]);
            }
            const actionPromise = this.graphActionsService.fromDataTransferItems(items, hoverPosition);

            this.ngZone.runOutsideAngular(() => {
              actionPromise.then((actions) => {
                if (actions.length) {
                  NgZone.assertNotInAngularZone();
                  this.canvasGraphView.execute(new CompoundAction('Drag to map', actions));
                  this.canvasGraphView.focus();
                }
              });
            });
          }
        }),
      ),
      this.fromCanvasEvent<DragEvent>('dragend'),
    ).pipe(
      map((event) => false /*drop area not targeted*/),
    ),
  ).pipe(
    distinctUntilChanged(),
    tap((dropTargeted) => {
      this.renderer[dropTargeted ? 'addClass' : 'removeClass'](
        this.canvasElem.nativeElement,
        'drop-target',
      );
    }),
    catchError((error) => {
      this.errorHandler.logError(error);
      return of(false);
    }),
  );

  // Hook to convas events outside of angular zone
  private fromCanvasEvent<E extends Event>(eventName: string): Observable<E> {
    return fromRendererEvent<E>(
      this.renderer,
      this.canvasElem.nativeElement,
      eventName,
    );
  }

  ngOnDestroy() {
    this.dragAndDropSubscription?.unsubscribe();
    this.canvasGraphView.destroy();
  }

  ngOnChanges({disableDragAndDrop}: SimpleChanges): void {
    if (disableDragAndDrop) {
      this.updateDragAndDrop();
    }
  }

  updateDragAndDrop(): void {
      if (this.disableDragAndDrop) {
        this.dragAndDropSubscription?.unsubscribe();
      } else {
        this.ngZone.runOutsideAngular(() => {
          this.dragAndDropSubscription = this.dragAndDrop$.subscribe();
        });
      }
  }

  ngOnInit(): void {
    this.updateDragAndDrop()
  }
}
