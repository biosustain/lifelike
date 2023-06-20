import {
  Directive,
  ElementRef,
  HostBinding,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';

import { defer } from 'lodash-es';
import { animationFrameScheduler, BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, takeUntil, throttleTime } from 'rxjs/operators';

import { CompoundAction } from 'app/graph-viewer/actions/actions';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { DelegateResourceManager } from 'app/graph-viewer/utils/resource/resource-manager';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { isNotEmpty } from 'app/shared/utils';
import { BehaviorList } from 'app/graph-viewer/renderers/behaviors';

import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';
import { GraphActionsService } from '../services/graph-actions.service';
import { MapImageProviderService } from '../services/map-image-provider.service';


@Directive({
  selector: 'canvas[appGraphView]',
})
export class GraphViewDirective extends CanvasGraphView implements OnDestroy, OnInit {
  private readonly listeners = [];
  private readonly dropTargeted$ = new BehaviorSubject(false);
  private readonly destroy$ = new Subject<void>();

  // @ts-ignore
  constructor(
    protected readonly canvasElem: ElementRef,
    protected readonly mapImageProviderService: MapImageProviderService,
    private readonly dataTransferDataService: DataTransferDataService,
    private readonly graphActionsService: GraphActionsService,
    private readonly ngZone: NgZone,
    private readonly renderer: Renderer2,
  ) {
    const style = new KnowledgeMapStyle(new DelegateResourceManager(mapImageProviderService));
    super(canvasElem.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
      groupRenderStyle: style,
    });
    this.addListener('dragend', this.dragEnd.bind(this));
    this.addListener('dragenter', this.dragEnter.bind(this));
    this.addListener('dragleave', this.dragLeave.bind(this));
    this.addListener('dragover', this.dragOver.bind(this));
    this.addListener('drop', this.drop.bind(this));
  }

  setDropTargetedClass(dropTargeted: boolean) {
    if (dropTargeted) {
      this.renderer.addClass(this.canvasElem.nativeElement, 'drop-target');
    } else {
      this.renderer.removeClass(this.canvasElem.nativeElement, 'drop-target');
    }
  }

  addListener(eventName: string, callback: (event: any) => (boolean | void)) {
    this.ngZone.runOutsideAngular(() => {
      this.listeners.push(
        this.renderer.listen(this.canvasElem.nativeElement, eventName, callback),
      );
    });
  }

  dragEnd(event: DragEvent) {
    this.dropTargeted$.next(false);
  }

  dragEnter(event: DragEvent) {
    this.dropTargeted$.next(true);
  }

  dragLeave(event: DragEvent) {
    this.dropTargeted$.next(false);
  }

  dragOver(event: DragEvent) {
    this.dropTargeted$.next(true);

    // As this event fire continuously, and we only need to check that once, do not re-check after the first one
    if (event.dataTransfer.dropEffect !== 'link') {
      if (event.dataTransfer.items[0]?.type.startsWith('image/') ||
        this.dataTransferDataService.extract(event.dataTransfer).filter(item => item.token === GRAPH_ENTITY_TOKEN).length) {
        event.dataTransfer.dropEffect = 'link';
        event.preventDefault();
      }
    }

  }

  drop(event: DragEvent) {
    event.preventDefault();

    this.dropTargeted$.next(false);

    const hoverPosition = this.hoverPosition;
    if (hoverPosition != null) {
      const items = this.dataTransferDataService.extract(event.dataTransfer);
      if (isNotEmpty(items)) {
        this.selection.replace([]);
      }
      const actionPromise = this.graphActionsService.fromDataTransferItems(items, hoverPosition);
      defer(() => {
        actionPromise.then(actions => {
          if (actions.length) {
            this.execute(new CompoundAction('Drag to map', actions));
          }
        });
      });
    }
  }

  ngOnInit(): void {
    this.dropTargeted$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      // Do not change state more often than once per frame
      throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
    ).subscribe(this.setDropTargetedClass.bind(this));
  }

  ngOnDestroy(): void {
    this.listeners.forEach(listener => listener());
    this.destroy$.next();
    this.destroy$.complete();
  }
}
