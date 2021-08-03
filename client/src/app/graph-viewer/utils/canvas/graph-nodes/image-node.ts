import { ResourceManager, ResourceOwner } from '../../resource/resource-manager';
import { RectangleNode, RectangleNodeOptions } from './rectangle-node';
import { Subscription } from 'rxjs';
import { PlacedNode } from '../../../styles/styles';
import { BaseRectangleNode, BaseRectangleNodeOptions } from './base-rectangle-node';

export interface ImageNodeOptions extends BaseRectangleNodeOptions {
  imageManager: ResourceManager<string, CanvasImageSource>;
  imageId: string;
}

/**
 * Draws an image.
 */
export class ImageNode extends BaseRectangleNode implements ResourceOwner {

  resourceOwnerClass = 'image-node';
  readonly resizable = true;
  readonly imageManager: ResourceManager<string, CanvasImageSource>;
  readonly imageId: string;
  protected readonly subscriptions = new Subscription();

  image: CanvasImageSource;

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
    this.ctx.save();
    if (this.image) {
      this.ctx.drawImage(this.image, this.nodeX, this.nodeY, this.nodeWidth, this.nodeHeight);
    } else {
      this.ctx.rect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight
      );
      this.ctx.lineWidth = 1 / transform.scale(1).k;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

}
