interface TextboxOptions {
  width?: number;
  height?: number;
  text: string;
  font: string;
  lineHeight?: number;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  verticalAlign?: TextAlignment;
  horizontalAlign?: TextAlignment;
}

/**
 * Draws text oriented around a point or within a box, with support for
 * alignment, wrapping, and cut off.
 */
export class CanvasTextbox {
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly text: string;
  readonly font: string;
  readonly lineHeight: number = 1.2;
  readonly actualLineHeight: number;
  readonly fillStyle: string | undefined = '#000';
  readonly strokeWidth: number = 1;
  readonly strokeStyle: string | undefined = null;
  readonly verticalAlign: TextAlignment = TextAlignment.Center;
  readonly horizontalAlign: TextAlignment = TextAlignment.Center;
  readonly lines: ComputedLine[];
  readonly lineMetrics: TextMetrics;
  readonly actualWidth: number;
  readonly actualHeight: number;
  readonly yOffset: number;
  readonly horizontalOverflow: boolean;
  readonly verticalOverflow: boolean;

  constructor(private ctx: CanvasRenderingContext2D, options: TextboxOptions) {
    Object.assign(this, options);

    ctx.font = this.font;

    // Calculate height of line
    this.lineMetrics = ctx.measureText('Mjpunkrockisntdead!');
    this.actualLineHeight = (this.lineMetrics.actualBoundingBoxAscent + this.lineMetrics.actualBoundingBoxDescent) * this.lineHeight;

    // Break the text into lines
    const {lines, horizontalOverflow, verticalOverflow, actualWidth} = this.computeLines();
    this.lines = lines;
    this.horizontalOverflow = horizontalOverflow;
    this.verticalOverflow = verticalOverflow;
    this.actualWidth = actualWidth;

    // Calculate vertical alignment
    this.actualHeight = this.lines.length * this.actualLineHeight - this.lineMetrics.actualBoundingBoxDescent;
    if (this.verticalAlign === TextAlignment.End) {
      if (this.height != null) {
        this.yOffset = this.height - this.actualHeight;
      } else {
        this.yOffset = -this.actualHeight;
      }
    } else if (this.verticalAlign === TextAlignment.Center) {
      if (this.height != null) {
        this.yOffset = (this.height - this.actualHeight) / 2;
      } else {
        this.yOffset = 0;
      }
    } else {
      if (this.height != null) {
        this.yOffset = 0;
      } else {
        this.yOffset = this.actualHeight;
      }
    }
  }

  calculateComputedLineMinX(metrics: TextMetrics): number {
    const width = metrics.width;
    if (this.horizontalAlign === TextAlignment.End) {
      if (this.width != null) {
        return this.width - width;
      } else {
        return -width;
      }
    } else if (this.horizontalAlign === TextAlignment.Center) {
      if (this.width != null) {
        return (this.width - width) / 2;
      } else {
        return 0;
      }
    } else {
      if (this.height != null) {
        return 0;
      } else {
        return width;
      }
    }
  }

  computeLines(): {
    lines: ComputedLine[],
    verticalOverflow: boolean,
    horizontalOverflow: boolean,
    actualWidth: number,
  } {
    // TODO: Clean up this disaster
    const lines: ComputedLine[] = [];
    const tokens = this.text.split(/ +/g);
    let horizontalOverflow = false;
    let actualWidth = 0;

    if (!tokens.length) {
      return {
        lines,
        verticalOverflow: false,
        horizontalOverflow,
        actualWidth,
      };
    }

    if (this.actualLineHeight > this.height) {
      return {
        lines,
        verticalOverflow: true,
        horizontalOverflow,
        actualWidth,
      };
    }

    if (this.width != null) {
      let currentLineTokens = [tokens[0]];
      let laggingLineMetrics: TextMetrics = this.ctx.measureText(currentLineTokens.join(' '));

      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        currentLineTokens.push(token);
        const currentLine = currentLineTokens.join(' ');
        const metrics = this.ctx.measureText(currentLine);

        if (metrics.width > this.width) {
          currentLineTokens.pop();

          if (laggingLineMetrics.width > this.width) {
            horizontalOverflow = true;
            actualWidth = this.width;
          } else {
            if (laggingLineMetrics.width > actualWidth) {
              actualWidth = laggingLineMetrics.width;
            }
          }

          lines.push({
            text: currentLineTokens.join(' '),
            metrics: laggingLineMetrics,
            xOffset: this.calculateComputedLineMinX(laggingLineMetrics),
            horizontalOverflow: laggingLineMetrics.width > this.width,
          });

          // We've overflowed the height
          if (this.height != null && (lines.length + 1) * this.actualLineHeight > this.height) {
            return {
              lines,
              verticalOverflow: true,
              horizontalOverflow,
              actualWidth,
            };
          }

          currentLineTokens = [
            token
          ];
          laggingLineMetrics = this.ctx.measureText(currentLineTokens.join(' '));
        } else {
          laggingLineMetrics = metrics;
        }
      }

      // Left over token
      if (currentLineTokens.length) {
        if (laggingLineMetrics.width > this.width) {
          horizontalOverflow = true;
          actualWidth = this.width;
        } else {
          if (laggingLineMetrics.width > actualWidth) {
            actualWidth = laggingLineMetrics.width;
          }
        }

        lines.push({
          text: currentLineTokens.join(' '),
          metrics: laggingLineMetrics,
          xOffset: this.calculateComputedLineMinX(laggingLineMetrics),
          horizontalOverflow: laggingLineMetrics.width > this.width,
        });
      }

      return {
        lines,
        verticalOverflow: false,
        horizontalOverflow,
        actualWidth,
      };
    } else {
      const metrics = this.ctx.measureText(this.text);

      return {
        lines: [{
          text: this.text,
          metrics,
          xOffset: this.calculateComputedLineMinX(metrics),
          horizontalOverflow: false,
        }],
        verticalOverflow: false,
        horizontalOverflow: false,
        actualWidth: metrics.width,
      };
    }
  }

  drawCenteredAt(x: number, y: number) {
    const width = this.width != null ? this.width : this.actualWidth;
    const height = this.height != null ? this.height : this.actualHeight;
    this.draw(x - width / 2, y - height / 2);
  }

  draw(minX: number, minY: number) {
    this.ctx.font = this.font;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line.horizontalOverflow) {
        if (this.strokeStyle) {
          this.ctx.lineWidth = this.strokeWidth;
          this.ctx.strokeStyle = this.strokeStyle;
          this.ctx.strokeText(line.text, minX + line.xOffset,
            minY + this.yOffset + (i * this.actualLineHeight) + this.lineMetrics.actualBoundingBoxAscent);
        }
        if (this.fillStyle) {
          this.ctx.fillStyle = this.fillStyle;
          this.ctx.fillText(line.text, minX + line.xOffset,
            minY + this.yOffset + (i * this.actualLineHeight) + this.lineMetrics.actualBoundingBoxAscent);
        }
      } else {
        if (this.fillStyle) {
          this.ctx.save();
          this.ctx.fillStyle = this.fillStyle;
          this.ctx.globalAlpha = 0.2;
          this.ctx.fillRect(
            minX,
            minY + this.yOffset + (i * this.actualLineHeight),
            this.width != null ? this.width : this.actualWidth,
            this.lineMetrics.actualBoundingBoxDescent + this.lineMetrics.actualBoundingBoxAscent
          );
          this.ctx.restore();
        }
      }
    }
  }
}

export enum TextAlignment {
  Start = 'start',
  Center = 'center',
  End = 'end',
}

interface ComputedLine {
  text: string;
  metrics: TextMetrics;
  xOffset: number;
  horizontalOverflow: boolean;
}
