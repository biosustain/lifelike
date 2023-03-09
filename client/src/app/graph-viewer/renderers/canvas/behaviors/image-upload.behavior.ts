import { MatSnackBar } from "@angular/material/snack-bar";

import { filter, merge } from "lodash-es";

import { MapImageProviderService } from "app/drawing-tool/services/map-image-provider.service";
import { NodeCreation } from "app/graph-viewer/actions/nodes";
import {
  IMAGE_DEFAULT_SIZE,
  SizeUnits,
  IMAGE_LABEL,
} from "app/shared/constants";
import { createImageNode, createNode } from "app/graph-viewer/utils/objects";

import {
  AbstractCanvasBehavior,
  BehaviorEvent,
  BehaviorResult,
} from "../../behaviors";
import { CanvasGraphView } from "../canvas-graph-view";

export class ImageUploadBehavior extends AbstractCanvasBehavior {
  protected readonly mimeTypePattern = /^image\/(jpeg|png|gif|bmp)$/i;
  protected readonly maxFileSize = 20;

  constructor(
    protected readonly graphView: CanvasGraphView,
    protected readonly mapImageProvider: MapImageProviderService,
    protected readonly snackBar: MatSnackBar
  ) {
    super();
  }

  private containsFiles(dataTransfer: DataTransfer) {
    return dataTransfer.types?.includes("Files");
  }

  private getFiles(dataTransfer: DataTransfer): File[] {
    return filter(dataTransfer.files, (file) => this.isSupportedFile(file));
  }

  private isSupportedFile(file: File) {
    if (file.type.match(this.mimeTypePattern)) {
      if (file.size <= this.maxFileSize * SizeUnits.MiB) {
        return true;
      }
      this.snackBar.open(
        `Image size too big (>${this.maxFileSize} MiB)`,
        null,
        {
          duration: 4000,
        }
      );
    }
    return false;
  }

  dragOver(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    if (dragEvent?.dataTransfer && this.containsFiles(dragEvent.dataTransfer)) {
      dragEvent.preventDefault();
    }
    return BehaviorResult.Continue;
  }

  // TODO: This should be able to handle image file drop. Inspect why it is not
  drop(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    const files = this.getFiles(dragEvent.dataTransfer);
    if (files.length) {
      this.graphView.selection.replace([]);
      dragEvent.stopPropagation();
      dragEvent.preventDefault();
      this.createImageNodes(files);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const clipboardEvent = event.event;
      const files = this.getFiles(clipboardEvent.clipboardData);
      if (files.length) {
        this.createImageNodes(files);
        clipboardEvent.preventDefault();
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }

  private createImageNodes(files: File[]) {
    let i = 0;
    for (const file of files) {
      this.createImageNode(file, 15 * i, 15 * i);
      i++;
    }
  }

  private createImageNode(file: File, xOffset = 0, yOffset = 0) {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const imageNode = createImageNode({});
      const { image_id } = imageNode;
      this.mapImageProvider
        .doInitialProcessing(image_id, file)
        .subscribe((dimensions) => {
          // Scale smaller side up to 300 px
          const ratio =
            IMAGE_DEFAULT_SIZE / Math.min(dimensions.width, dimensions.height);
          this.graphView.execute(
            new NodeCreation(
              `Insert image`,
              merge(imageNode, {
                data: {
                  x: position.x + xOffset,
                  y: position.y + yOffset,
                  width: dimensions.width * ratio,
                  height: dimensions.height * ratio,
                },
              }),
              true
            )
          );
        });
      return BehaviorResult.Stop;
    }
  }
}
