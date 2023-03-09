import { Directive, ElementRef, HostBinding, HostListener } from "@angular/core";

import { CanvasGraphView } from "app/graph-viewer/renderers/canvas/canvas-graph-view";
import { KnowledgeMapStyle } from "app/graph-viewer/styles/knowledge-map-style";
import { DelegateResourceManager } from "app/graph-viewer/utils/resource/resource-manager";
import { DataTransferDataService } from "app/shared/services/data-transfer-data.service";
import { isNotEmpty } from "app/shared/utils";
import { CompoundAction } from "app/graph-viewer/actions/actions";

import { MapImageProviderService } from "../services/map-image-provider.service";
import { GraphActionsService } from "../services/graph-actions.service";
import { GRAPH_ENTITY_TOKEN } from "../providers/graph-entity-data.provider";

@Directive({
  selector: "canvas[appGraphView]",
})
export class GraphViewDirective extends CanvasGraphView {
  @HostBinding("class.drop-target") dropTargeted;

  // @ts-ignore
  constructor(
    protected readonly canvasElem: ElementRef,
    protected readonly mapImageProviderService: MapImageProviderService,
    private readonly dataTransferDataService: DataTransferDataService,
    private readonly graphActionsService: GraphActionsService
  ) {
    const style = new KnowledgeMapStyle(new DelegateResourceManager(mapImageProviderService));
    super(canvasElem.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
      groupRenderStyle: style,
    });
  }

  @HostListener("dragend")
  dragEnd() {
    this.dropTargeted = false;
  }

  @HostListener("dragenter")
  dragEnter() {
    this.dropTargeted = true;
  }

  @HostListener("dragleave")
  dragLeave() {
    this.dropTargeted = false;
  }

  @HostListener("dragover", ["$event"])
  dragOver(event: DragEvent) {
    this.dropTargeted = true;

    // As this event fire continuously, and we only need to check that once, do not re-check after the first one
    if (event.dataTransfer.dropEffect !== "link") {
      if (
        event.dataTransfer.items[0]?.type.startsWith("image/") ||
        this.dataTransferDataService
          .extract(event.dataTransfer)
          .filter((item) => item.token === GRAPH_ENTITY_TOKEN).length
      ) {
        event.dataTransfer.dropEffect = "link";
        event.preventDefault();
      }
    }
  }

  @HostListener("drop", ["$event"])
  drop(event: DragEvent) {
    event.preventDefault();

    this.dropTargeted = false;

    const hoverPosition = this.hoverPosition;
    if (hoverPosition != null) {
      const items = this.dataTransferDataService.extract(event.dataTransfer);
      if (isNotEmpty(items)) {
        this.selection.replace([]);
      }
      const actionPromise = this.graphActionsService.fromDataTransferItems(items, hoverPosition);

      actionPromise.then((actions) => {
        if (actions.length) {
          this.execute(new CompoundAction("Drag to map", actions));
          this.focus();
        }
      });
    }
  }
}
