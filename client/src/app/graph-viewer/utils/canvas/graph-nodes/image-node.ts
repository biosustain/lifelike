import { Subscription } from 'rxjs';

import { ResourceManager, ResourceOwner } from '../../resource/resource-manager';
import { BaseRectangleNode, BaseRectangleNodeOptions } from './base-rectangle-node';
import {Line} from '../lines/lines';

export interface ImageNodeOptions extends BaseRectangleNodeOptions {
  imageManager: ResourceManager<string, CanvasImageSource>;
  imageId: string;
  stroke?: Line;
}

/**
 * Draws an image.
 */
export class ImageNode extends BaseRectangleNode implements ResourceOwner {

  resourceOwnerClass = 'image-node';
  readonly resizable = true;
  readonly uniformlyResizable = true;
  readonly imageManager: ResourceManager<string, CanvasImageSource>;
  readonly imageId: string;
  protected readonly subscriptions = new Subscription();
  readonly stroke: Line | undefined;

  // Images are larger - it might be good to experiment with a larger stroke by default
  readonly IMAGE_STROKE_FACTOR = 2;

  private image: CanvasImageSource;

  constructor(ctx: CanvasRenderingContext2D, options: ImageNodeOptions) {
    super(ctx, options);
  }

  objectDidBind() {
    super.objectDidBind();
    this.subscriptions.add(this.imageManager.acquire(this, this.imageId).subscribe(image => {
      this.image = image;
      this.forceRender();
    }));
  }

  objectWillUnbind() {
    this.imageManager.release(this);
    this.subscriptions.unsubscribe();
    super.objectWillUnbind();
  }

  draw(transform: any): void {
    const zoomResetScale = 1 / transform.scale(1).k;
    this.ctx.save();
    if (this.image) {
      this.ctx.drawImage(this.image, this.nodeX, this.nodeY, this.nodeWidth, this.nodeHeight);
      const ctx = this.ctx;

      if (this.stroke) {
        this.stroke.setContext(ctx);
        const lineWidth = zoomResetScale * ctx.lineWidth * this.IMAGE_STROKE_FACTOR;
        this.ctx.rect(
          this.nodeX - lineWidth / 2.0,
          this.nodeY - lineWidth / 2.0,
          this.nodeWidth + lineWidth / 2.0,
          this.nodeHeight + lineWidth / 2.0
        );
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    } else {
      this.ctx.rect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight
      );
      this.ctx.lineWidth = zoomResetScale;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

}
