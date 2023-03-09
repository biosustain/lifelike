import * as d3 from "d3";
import { ZoomTransform } from "d3-zoom";

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
  UniversalGraphNodelike,
} from "app/drawing-tool/services/interfaces";
import { Arrowhead } from "app/graph-viewer/utils/canvas/line-heads/arrow";
import { EdgeCreation } from "app/graph-viewer/actions/edges";
import {
  AbstractObjectHandleBehavior,
  Handle,
} from "app/graph-viewer/utils/behaviors/abstract-object-handle-behavior";
import { PlacedNode } from "app/graph-viewer/styles/styles";
import { HANDLE_BLUE_COLOR } from "app/shared/constants";
import { DEFAULT_FONT_SIZE } from "app/sankey/services/layout.service";

import { CanvasGraphView } from "../canvas-graph-view";
import {
  AbstractCanvasBehavior,
  BehaviorEvent,
  BehaviorResult,
  DragBehaviorEvent,
} from "../../behaviors";
import { CanvasFont, Point } from "../../../utils/canvas/shared";

const HANDLE_BEHAVIOR_KEY = "_interactive-edge-creation/handle";
const HELPER_BEHAVIOR_KEY = "_interactive-edge-creation/helper";

export class InteractiveEdgeCreationBehavior extends AbstractCanvasBehavior {
  /**
   * Subscription for when the selection changes.
   */
  private selectionChangeSubscription;

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  setup() {
    this.selectionChangeSubscription = this.graphView.selection.changeObservable.subscribe(
      ([newSelection, oldSelection]) => {
        if (
          newSelection.length === 1 &&
          (newSelection[0].type === GraphEntityType.Node ||
            newSelection[0].type === GraphEntityType.Group)
        ) {
          this.graphView.behaviors.delete(HANDLE_BEHAVIOR_KEY);

          this.graphView.behaviors.add(
            HANDLE_BEHAVIOR_KEY,
            new ActiveEdgeCreationHandle(
              this.graphView,
              newSelection[0].entity as UniversalGraphNodelike
            ),
            2
          );
        } else {
          this.graphView.behaviors.delete(HANDLE_BEHAVIOR_KEY);
        }
      }
    );
  }
}

class ActiveEdgeCreationHandle extends AbstractObjectHandleBehavior<
  Handle,
  UniversalGraphNodelike
> {
  protected topOffset = 0;
  protected leftOffset = 0;
  protected size = 20;

  constructor(graphView: CanvasGraphView, target: UniversalGraphNode) {
    super(graphView, target);
  }

  drawHandle(
    ctx: CanvasRenderingContext2D,
    transform: ZoomTransform,
    { minX, minY, maxX, maxY }: Handle
  ) {
    // Draw Handle
    const noZoomScaleHandle = 1 / this.graphView.transform.scale(1).k;
    const nodeRadiusHandle = (this.size / 2) * noZoomScaleHandle;
    const xHandle = (maxX - minX) / 2 + minX;
    const yHandle = (maxY - minY) / 2 + minY;
    const scaledfont = new CanvasFont(ctx.font, { size: DEFAULT_FONT_SIZE * noZoomScaleHandle });

    ctx.save();
    ctx.moveTo(xHandle, yHandle);
    ctx.arc(xHandle, yHandle, nodeRadiusHandle, 0, 2 * Math.PI);
    ctx.strokeStyle = "#2B7CE9";
    ctx.stroke();
    ctx.font = String(scaledfont);
    ctx.fillStyle = HANDLE_BLUE_COLOR;
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("+", xHandle, yHandle + 5 * noZoomScaleHandle);
    ctx.restore();
  }

  getHandleBoundingBoxes(placedNode: PlacedNode): Handle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = this.size * noZoomScale;
    const halfSize = size / 2;
    const x = (bbox.maxX - bbox.minX) / 2 + bbox.minX;
    const y = bbox.minY;
    return [
      // Top left
      {
        minX: x - halfSize + this.leftOffset,
        minY: y - halfSize + this.topOffset,
        maxX: x + halfSize + this.leftOffset,
        maxY: y + halfSize + this.topOffset,
      },
    ];
  }

  protected activeDragStart(
    event: MouseEvent,
    graphPosition: Point,
    subject: GraphEntity | undefined
  ) {
    if (
      subject != null &&
      (subject.type === GraphEntityType.Node || subject.type === GraphEntityType.Group)
    ) {
      this.graphView.behaviors.delete(HELPER_BEHAVIOR_KEY);
      this.graphView.behaviors.add(
        HELPER_BEHAVIOR_KEY,
        new ActiveEdgeCreationHelper(this.graphView, subject.entity as UniversalGraphNodelike),
        10
      );
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}

class ActiveEdgeCreationHelper extends AbstractCanvasBehavior {
  private to: {
    data: {
      x;
      y;
    };
  } = null;

  constructor(
    private readonly graphView: CanvasGraphView,
    private readonly from: UniversalGraphNodelike
  ) {
    super();
  }

  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    if (event.event.key === "Escape" || event.event.key === "Delete") {
      this.graphView.requestRender();
      return BehaviorResult.RemoveAndStop;
    } else {
      return BehaviorResult.Stop;
    }
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    // TODO: Cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = this.graphView.transform.invertX(mouseX);
    const graphY = this.graphView.transform.invertY(mouseY);

    this.to = {
      data: {
        x: graphX,
        y: graphY,
      },
    };

    this.graphView.requestRender();
    return BehaviorResult.Stop;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse();

    if (
      subject &&
      (subject.type === GraphEntityType.Group || subject.type === GraphEntityType.Node)
    ) {
      const entity = subject.entity as UniversalGraphNodelike;
      if (entity !== this.from) {
        this.graphView.execute(
          new EdgeCreation(
            "Create connection",
            {
              from: this.from.hash,
              to: entity.hash,
              label: null,
            },
            true
          )
        );
        this.graphView.requestRender();
      }
    }
    return BehaviorResult.RemoveAndStop;
  }

  draw(ctx: CanvasRenderingContext2D, transform: ZoomTransform) {
    const from = this.from;
    const to = this.to;

    if (to) {
      ctx.beginPath();
      const noZoomScale = 1 / transform.scale(1).k;
      const color = "#2B7CE9";
      const lineWidth = noZoomScale;

      // Draw arrow
      const arrow = new Arrowhead(16, {
        fillStyle: color,
        strokeStyle: null,
        lineWidth,
      });
      const drawnTerminator = arrow.draw(ctx, from.data.x, from.data.y, to.data.x, to.data.y);

      // Draw line
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.moveTo(from.data.x, from.data.y);
      ctx.lineTo(drawnTerminator.startX, drawnTerminator.startY);
      ctx.stroke();

      // Draw the 'o' node at the end of the line
      const nodeRadius = 6 * noZoomScale;
      const x = to.data.x;
      const y = to.data.y;
      ctx.moveTo(x, y);
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = "#2B7CE9";
      ctx.stroke();
      ctx.fillStyle = HANDLE_BLUE_COLOR;
      ctx.fill();
    }
  }
}
