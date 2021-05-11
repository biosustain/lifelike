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
  goId?: string;
  goTerm: string;
}

interface RowHeader {
  y: number;
  key: string;
}

interface Match {
  x: number;
  y: number;
  value?: number;
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  @Input() show: boolean;

  matches: Match[];
  genes: RowHeader[];
  goTerms: ColumnHeader[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;


  @HostBinding('style') private size;

  _itemSize;
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

  rowOrder(a: KeyValue<string, GeneRow>, b: KeyValue<string, GeneRow>) {
    return b.value.frequency - a.value.frequency;
  }

  columnOrder(a: EnrichWithGOTermsResult, b: EnrichWithGOTermsResult) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    if (this.show) {
      const data = [...this.data].sort(this.columnOrder).map((o, i) => ({...o, x: i}));
      let genes = new Map<string, number>();
      let matches;
      let goTerms;
      if (this.showMore) {
        goTerms = data;
        matches = data.reduce((o1, {geneNames}, goIndex) =>
            geneNames.reduce((o2, g) => {
              let frequency = genes.get(g);
              if (!frequency) {
                genes.set(g, 1);
              } else {
                genes.set(g, ++frequency);
              }
              o2.push({
                x: goIndex,
                y: g
              });
              return o2;
            }, o1)
          , []);
      } else {
        const sliceSize = Math.min(data.length, 25);
        // @ts-ignore
        goTerms = data.slice(0, sliceSize).concat([{
          goTerm: 'others',
          x: sliceSize
        } as ColumnHeader]) as ColumnHeader;
        const others = new Map<string, any>();
        matches = data.reduce((o1, {geneNames}, goIndex) => {
          if (goIndex < sliceSize) {
            return geneNames.reduce((o2, g) => {
              let frequency = genes.get(g);
              if (!frequency) {
                genes.set(g, 1);
              } else {
                genes.set(g, ++frequency);
              }
              o2.push({
                x: goIndex,
                y: g
              });
              return o2;
            }, o1);
          } else {
            return geneNames.reduce((o2, g) => {
              let frequency = genes.get(g);
              if (frequency) {
                genes.set(g, ++frequency);
              }
              if (!genes.has(g)) {
                g = 'others';
                genes.set(g, 0);
              }
              let cell = others.get(g);
              if (!cell) {
                cell = {
                  y: g,
                  x: sliceSize,
                  value: 1
                };
                others.set(g, cell);
                o2.push(cell);
              } else {
                cell.value++;
              }
              return o2;
            }, o1);
          }
        }, []);
      }
      // get row order
      genes = new Map(
        [...genes]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v], i) => [k, i])
      );
      this.genes = [...genes].map(([key, i]) => ({key, y: i})) as RowHeader[];
      this.matches = matches
        .map(({y, ...rest}) => ({y: genes.get(y), ...rest})) as Match[];
      this.goTerms = goTerms as ColumnHeader[];
    }
  }
}
