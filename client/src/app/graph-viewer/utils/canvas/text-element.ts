import { nullCoalesce } from '../types';

interface TextboxOptions {
  width?: number;
  maxWidth?: number;
  height?: number;
  maxHeight?: number;
  maxLines?: number;
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
export class TextElement {
  readonly width: number | undefined;
  readonly maxWidth: number | undefined;
  readonly height: number | undefined;
  readonly maxHeight: number | undefined;
  readonly maxLines: number | undefined;
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

  calculateComputedLineMinX(metrics: TextMetrics, actualWidth: number | undefined): number {
    const width = metrics.width;
    if (this.horizontalAlign === TextAlignment.End) {
      if (this.width != null) {
        return this.width - width;
      } else if (actualWidth != null) {
        return actualWidth - width;
      } else {
        return -width;
      }
    } else if (this.horizontalAlign === TextAlignment.Center) {
      if (this.width != null) {
        return (this.width - width) / 2;
      } else if (actualWidth != null) {
        return (actualWidth - width) / 2;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  private getEffectiveWidth() {
    if (this.width != null && this.maxWidth != null) {
      return Math.min(this.width, this.maxWidth);
    } else if (this.width != null) {
      return this.width;
    } else {
      return this.maxWidth;
    }
  }

  private getEffectiveHeight() {
    if (this.height != null && this.maxHeight != null) {
      return Math.min(this.height, this.maxHeight);
    } else if (this.height != null) {
      return this.height;
    } else {
      return this.maxHeight;
    }
  }

  computeLines(): {
    lines: ComputedLine[],
    verticalOverflow: boolean,
    horizontalOverflow: boolean,
    actualWidth: number,
  } {
    const effectiveWidth = this.getEffectiveWidth();
    const effectiveHeight = this.getEffectiveHeight();

    if (this.actualLineHeight > effectiveHeight || (this.maxLines != null && this.maxLines <= 0)) {
      // If the box is too small to fit even one line of text
      const metrics = this.ctx.measureText(this.text);

      return {
        lines: [],
        verticalOverflow: true,
        horizontalOverflow: true,
        actualWidth: nullCoalesce(this.width, this.maxWidth, metrics.width),
      };

    } else if (effectiveWidth != null) {
      // If we have a width to confirm to
      let boxHorizontalOverflow = false;
      let boxVerticalOverflow = true;
      let actualWidth = 0;
      const tokens = this.text.split(/ +/g);
      const lines: ComputedLine[] = [];

      for (const {line, metrics, remainingTokens} of this.getWidthFittedLines(tokens, effectiveWidth)) {
        const lineHorizontalOverflow = metrics.width > effectiveWidth;

        if (lineHorizontalOverflow) {
          // If this line overflows, make sure to mark the box as overflowing and
          // update the width of the box
          boxHorizontalOverflow = true;
          actualWidth = effectiveWidth;
        } else if (metrics.width > actualWidth) {
          // If the line isn't overflowing but this line's width is longer than the
          // running actual width, update that
          actualWidth = metrics.width;
        }

        lines.push({
          text: line,
          metrics,
          xOffset: 0, // We'll update later
          horizontalOverflow: lineHorizontalOverflow,
        });

        // We've overflow the height if we add another line
        if (remainingTokens && (
          (effectiveHeight != null && (lines.length + 1) * this.actualLineHeight > effectiveHeight)
          || (this.maxLines != null && lines.length >= this.maxLines))
        ) {
          boxVerticalOverflow = true;
          break;
        }
      }

      // Do X offset for center and other alignments
      // Do this in a second phase because actualWidth is still being calculated
      for (const line of lines) {
        line.xOffset = this.calculateComputedLineMinX(line.metrics, actualWidth);
      }

      return {
        lines,
        verticalOverflow: boxVerticalOverflow,
        horizontalOverflow: boxHorizontalOverflow,
        actualWidth,
      };
    } else {
      // If we have no width to conform to at all
      const metrics = this.ctx.measureText(this.text);

      return {
        lines: [{
          text: this.text,
          metrics,
          xOffset: this.calculateComputedLineMinX(metrics, metrics.width),
          horizontalOverflow: false,
        }],
        verticalOverflow: false,
        horizontalOverflow: false,
        actualWidth: metrics.width,
      };
    }
  }

  * getWidthFittedLines(tokens: string[], maxWidth: number):
    IterableIterator<{ line: string, metrics: TextMetrics, remainingTokens: boolean }> {
    if (!tokens.length) {
      return;
    }

    let lineTokens = [tokens[0]];
    let line = tokens[0];
    let metrics: TextMetrics = this.ctx.measureText(lineTokens.join(' '));

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      lineTokens.push(token);
      const lineTokensWithToken = lineTokens.join(' ');
      lineTokens.pop();
      const metricsWithToken = this.ctx.measureText(lineTokensWithToken);

      if (metricsWithToken.width > maxWidth) {
        yield {
          line,
          metrics,
          remainingTokens: true,
        };

        lineTokens = [token];
        line = token;
        metrics = this.ctx.measureText(line);
      } else {
        lineTokens.push(token);
        line = lineTokensWithToken;
        metrics = metricsWithToken;
      }
    }

    // Left over token
    if (lineTokens.length) {
      yield {
        line,
        metrics,
        remainingTokens: false,
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
