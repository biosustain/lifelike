import { cssValueToPx } from '../css-value-to.px';

export interface FlexColumn {
  flexBasis?: string | number; // CSS value in px or %
  width?: string | number; // CSS value in px or %
  minContent: number;
  maxContent: number;
  flexGrow?: number;
  flexShrink?: number;
}

export class FlexColumnsLayout {
  static recalculate<C extends FlexColumn>(
    containerWidth: number,
    columns: C[]
  ): {
    column: C;
    width: number;
  }[] {
    // Wrote this code based on this article
    // https://www.quirksmode.org/css/flexbox-algorithm.html
    // Determine initial width
    const columnsCalculation = columns.map((column) => {
      const flexBasisPx = cssValueToPx(column.flexBasis, containerWidth);
      const widthPx = cssValueToPx(column.width, containerWidth);
      let calculatedWidth;
      if (column.minContent < flexBasisPx) {
        calculatedWidth = flexBasisPx;
      } else if (widthPx < column.maxContent) {
        calculatedWidth = Math.max(widthPx, flexBasisPx);
      } else {
        calculatedWidth = flexBasisPx ?? widthPx ?? column.maxContent;
      }
      return {
        calculatedWidth,
        flexBasisPx,
        widthPx,
        column,
      };
    });
    const totalWidth = columnsCalculation.reduce(
      (sum, { calculatedWidth }) => sum + calculatedWidth,
      0
    );
    const numberOfColumns = columnsCalculation.length;
    let offset = containerWidth - totalWidth;
    const resizeColumn = (columnCalculation: any, delta: number) => {
      const peviousWidth = columnCalculation.calculatedWidth;
      columnCalculation.calculatedWidth += delta;
      if (columnCalculation.calculatedWidth < columnCalculation.column.minContent) {
        columnCalculation.calculatedWidth = columnCalculation.column.minContent;
      }
      offset += peviousWidth - columnCalculation.calculatedWidth;
    };
    // Flex shrinking
    for (let index = 0; index < numberOfColumns && Math.round(offset) < 0; index++) {
      const columnCalculation = columnsCalculation[index];
      const reaminingColumnsFlex = columnsCalculation
        .slice(index)
        .reduce((sum, { column }) => sum + (column.flexShrink ?? 1), 0);
      if (reaminingColumnsFlex === 0) {
        break;
      }
      const flexibility =
        (offset * (columnCalculation.column.flexShrink ?? 1)) / reaminingColumnsFlex;
      resizeColumn(columnCalculation, flexibility);
    }
    // Flex growing
    // https://webinista.com/updates/how-does-flexbox-work/
    for (let index = 0; index < numberOfColumns && Math.round(offset) > 0; index++) {
      const columnCalculation = columnsCalculation[index];
      const reaminingColumnsFlex = columnsCalculation
        .slice(index)
        .reduce((sum, { column }) => sum + (column.flexGrow ?? 0), 0);
      if (reaminingColumnsFlex === 0) {
        break;
      }
      const flexibility =
        (offset * (columnCalculation.column.flexGrow ?? 0)) / reaminingColumnsFlex;
      resizeColumn(columnCalculation, flexibility);
    }
    return columnsCalculation.map(({ column, calculatedWidth }) => ({
      column,
      width: calculatedWidth,
    }));
  }
}
