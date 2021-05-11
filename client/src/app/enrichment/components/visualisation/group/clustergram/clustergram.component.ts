import { Component, Input, OnChanges, HostBinding } from '@angular/core';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult, EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';
import { KeyValue } from '@angular/common';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { DomSanitizer } from '@angular/platform-browser';

class GeneRow {
  values: boolean[];
  frequency: number;
  others: number;

  constructor(sliceSize) {
    this.values = new Array(sliceSize);
    this.frequency = 0;
    this.others = 0;
  }
}

interface ColumnHeader {
  x: number;
  goId?: number;
  goTerm: string;
}

interface RowHeader {
  y: number;
  key: string;
}

interface Match {
  x: number;
  y: number | string;
  value?: number;
}

const OTHERS = 'others';

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  get itemSize() {
    return this._itemSize;
  }

  set itemSize(itemSize) {
    this._itemSize = itemSize;
    this.size = this.sanitizer.bypassSecurityTrustStyle(
      `--sizeX: ${itemSize[0]}px;--sizeY: ${itemSize[1]}px;`
    );
  }

  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly scrollDispatcher: ScrollDispatcher,
    private sanitizer: DomSanitizer
  ) {
    this.itemSize = [35, 35];
  }

  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  @Input() show: boolean;

  cells: Match[];
  rowHeaders: RowHeader[];
  columnHeaders: ColumnHeader[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;


  @HostBinding('style') private size;

  _itemSize;

  private static _valueMapToSortedList(valueMap: Map<string, number>): [string, number][] {
    return [...valueMap].sort((a, b) => b[1] - a[1]);
  }

  private static _sortedListToIndexMap(sortedList: [string, number][]): Map<string, number> {
    return new Map(
      sortedList
        .map(([k, v], i) => [k, i])
    );
  }

  private static _indexMapToRowHeaders(indexMap: Map<string, number>): RowHeader[] {
    return [...indexMap].map(([key, i]) => ({key, y: i} as RowHeader));
  }

  private static _goTermsToColumnHeaders(goTerms: EnrichWithGOTermsResult[]): ColumnHeader[] {
    return goTerms.map(({goId, goTerm}, i) => ({goId, goTerm, x: i} as ColumnHeader));
  }

  private static _mapRowNameToIndex(data: any[], indexMap: Map<string, number>) {
    return data.map(({y, ...rest}) => ({y: indexMap.get(y), ...rest}));
  }

  private static _valueMapToColumn(valueMap, columnIndex): Match[] {
    return [...valueMap].map(([y, value]) => ({y, x: columnIndex, value}));
  }

  rowOrder(a: KeyValue<string, GeneRow>, b: KeyValue<string, GeneRow>) {
    return b.value.frequency - a.value.frequency;
  }

  // sort by number of related gene names in each go term
  columnOrder(a: EnrichWithGOTermsResult, b: EnrichWithGOTermsResult) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    if (this.show) {
      // Sort copy of data
      const data: EnrichWithGOTermsResult[] = [...this.data].sort(this.columnOrder);
      const rowMentions = new Map<string, number>();
      let columnHeaders, geneIndex;
      // Iterate through columns and nested rows collecting points and number of ref per row
      let matches: Match[] = data.reduce((o1, {geneNames}, goIndex) =>
          geneNames.reduce((o2, g) => {
            const frequency = rowMentions.get(g);
            rowMentions.set(g, (frequency || 0) + 1);
            o2.push({
              x: goIndex,
              y: g
            });
            return o2;
          }, o1)
        , [] as Match[]);
      // get gene order
      const sortedGeneList = ClustergramComponent._valueMapToSortedList(rowMentions);
      if (this.showMore) {
        columnHeaders = ClustergramComponent._goTermsToColumnHeaders(data);
        // resolve row index for each gene
        geneIndex = ClustergramComponent._sortedListToIndexMap(sortedGeneList);
      } else {
        const sliceSize = Math.min(data.length, 25);
        if (data.length > sliceSize) {
          const {matches: slicedMatches, shown, others} = matches.reduce((o, n) => {
            if (n.x < sliceSize) {
              // show all cells within column limit
              o.matches.push(n);
              // and save which rows are being shown
              o.shown.add(n.y);
            } else {
              // if row has been shown accumulate 'others' for it
              // otherwise dump to row/column 'others' common cell
              const rowId = o.shown.has(n.y) ? n.y : OTHERS;
              const othersNumber = o.others.get(rowId);
              o.others.set(rowId, (othersNumber || 0) + 1);
            }
            return o;
          }, {
            matches: [] as Match[],
            shown: new Set(),
            others: new Map(),
          });
          // add column of others at index equal to sliced size
          const othersCells = ClustergramComponent._valueMapToColumn(others, sliceSize);
          matches = slicedMatches.concat(othersCells);
          columnHeaders = ClustergramComponent._goTermsToColumnHeaders(
            data.slice(0, sliceSize)
          );
          columnHeaders.push({
            goTerm: OTHERS,
            x: sliceSize
          } as ColumnHeader);
          // resolve row index for each shown gene
          const sortedShownGenes = sortedGeneList.filter(d => shown.has(d[0]));
          // add others row
          sortedShownGenes.push([OTHERS, 0]);
          geneIndex = ClustergramComponent._sortedListToIndexMap(sortedShownGenes);
        }
      }
      // generate rows headers
      this.rowHeaders = ClustergramComponent._indexMapToRowHeaders(geneIndex);
      // generate cells
      this.cells = ClustergramComponent._mapRowNameToIndex(matches, geneIndex);
      // generate column headers
      this.columnHeaders = columnHeaders;
    }
  }
}
