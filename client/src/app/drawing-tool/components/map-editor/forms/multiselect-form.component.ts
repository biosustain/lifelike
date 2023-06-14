import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { combineLatest, Observable, ReplaySubject, Subject } from 'rxjs';
import {
  flatMap as _flatMap,
  groupBy as _groupBy,
  map as _map,
  flow as _flow,
  identity as _identity,
  mapValues as _mapValues,
  keys as _keys,
  includes as _includes,
  some as _some,
  pick as _pick,
  values as _values,
  get as _get,
  thru as _thru,
} from 'lodash/fp';
import { filter, map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphGroup,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { ExplainService } from 'app/shared/services/explain.service';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { GraphView } from 'app/graph-viewer/renderers/graph-view';

import { InfoPanel } from '../../../models/info-panel';
import { getTermsFromGraphEntityArray } from '../../../utils/terms';

@Component({
  selector: 'app-multiselect-form',
  styleUrls: ['./entity-form.component.scss'],
  templateUrl: './multiselect-form.component.html',
})
export class MultiselectFormComponent implements OnChanges, OnDestroy {
  constructor(protected readonly explainService: ExplainService) {}
  change$ = new ReplaySubject<SimpleChanges>(1);
  possibleExplanation$: Observable<string> = this.change$.pipe(
    map(_pick(['selected', 'graphView'])),
    filter(_flow(_values, _some(Boolean))),
    switchMap(() =>
      this.explainService.relationship(
        new Set<string>(
          getTermsFromGraphEntityArray.call(
            // We might run into situation when only one of them is beeing changed
            // therefore it is safe to address them this way
            this.graphView,
            this.selected
          )
        )
      )
    )
  );
  groupedSelection$: Observable<Partial<Record<GraphEntityType, GraphEntity[]>>> =
    this.change$.pipe(
      map(_get('selected')),
      filter(Boolean),
      map(
        _flow(
          _thru(({ currentValue }) => currentValue),
          _groupBy(({ type }: GraphEntity) => type),
          _mapValues(_map(({ entity }) => entity))
        )
      )
    );
  @Input() infoPanel: InfoPanel;
  @Input() graphView: CanvasGraphView;
  @Input() selected: GraphEntity[];

  ngOnChanges(changes: SimpleChanges) {
    this.change$.next(changes);
  }

  ngOnDestroy() {
    this.change$.complete();
  }
}
