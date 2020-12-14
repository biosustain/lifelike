import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { MapImageProviderService } from '../../../../drawing-tool/services/map-image-provider.service';
import { NodeCreation } from '../../../actions/nodes';
import { makeid } from '../../../../drawing-tool/services';

export class ImageUploadBehavior extends AbstractCanvasBehavior {

  protected readonly mimeTypePattern = /^image\/(jpeg|png|gif|bmp)$/i;
  protected readonly maxFileSize = 1024 * 1024 * 40;

  constructor(protected readonly graphView: CanvasGraphView,
              protected readonly mapImageProvider: MapImageProviderService) {
    super();
  }

  private containsFiles(dataTransfer: DataTransfer) {
    if (dataTransfer.types) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < dataTransfer.types.length; i++) {
        if (dataTransfer.types[i] === 'Files') {
          return true;
        }
      }
    }

    return false;
  }

  private getFiles(dataTransfer: DataTransfer): File[] {
    const result: File[] = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (this.isSupportedFile(file)) {
        result.push(file);
      }
    }
    return result;
  }

  private isSupportedFile(file: File) {
    return file.type.match(/^image\/(jpeg|png|gif|bmp)$/i) && file.size <= this.maxFileSize;
  }

  dragOver(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    if (this.containsFiles(dragEvent.dataTransfer)) {
      dragEvent.preventDefault();
    }
    return BehaviorResult.Continue;
  }

  drop(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    const files = this.getFiles(dragEvent.dataTransfer);
    if (files.length) {
      dragEvent.stopPropagation();
      dragEvent.preventDefault();
      this.createImageNodes(files);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const clipboardEvent = event.event;
    const files = this.getFiles(clipboardEvent.clipboardData);
    if (files.length) {
      clipboardEvent.stopPropagation();
      clipboardEvent.preventDefault();
      this.createImageNodes(files);
      return BehaviorResult.Stop;
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
      const imageId = makeid();
      this.mapImageProvider.setMemoryImage(imageId, URL.createObjectURL(file));
      this.graphView.execute(new NodeCreation(
        `Insert image`, {
          hash: makeid(),
          image_id: imageId,
          display_name: '',
          label: 'image',
          sub_labels: [],
          data: {
            x: position.x + xOffset,
            y: position.y + yOffset,
          },
        }, true,
      ));
      return BehaviorResult.Stop;
    }
  }

}
