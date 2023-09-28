import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { Observable, ReplaySubject } from 'rxjs';
import {
  flow as _flow,
  get as _get,
  groupBy as _groupBy,
  map as _map,
  mapValues as _mapValues,
  pick as _pick,
  some as _some,
  thru as _thru,
  values as _values,
} from 'lodash/fp';
import { filter, map } from 'rxjs/operators';

import { GraphEntity, GraphEntityType } from 'app/drawing-tool/services/interfaces';
import { ExplainService } from 'app/shared/services/explain.service';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { WorkspaceManager } from 'app/workspace/services/workspace-manager';

import { InfoPanel } from '../../../models/info-panel';
import { getTermsFromGraphEntityArray } from '../../../utils/terms';
import { EntityForm } from './entity-form';

@Component({
  selector: 'app-multiselect-form',
  styleUrls: ['./entity-form.component.scss'],
  templateUrl: './multiselect-form.component.html',
})
export class MultiselectFormComponent extends EntityForm implements OnChanges, OnDestroy {
  constructor(
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly explainService: ExplainService
  ) {
    super(workspaceManager);
  }

  protected readonly TABS: string[] = ['graph', 'explanation'];

  readonly change$ = new ReplaySubject<SimpleChanges>(1);
  readonly entities$: Observable<Iterable<string>> = this.change$.pipe(
    map(_pick(['selected', 'graphView'])),
    filter(_flow(_values, _some(Boolean))),
    map(
      () =>
        new Set<string>(
          getTermsFromGraphEntityArray.call(
            // We might run into situation when only one of them is beeing changed
            // therefore it is safe to address them this way
            this.graphView,
            this.selected
          )
        )
    )
  );
  readonly groupedSelection$: Observable<Partial<Record<GraphEntityType, GraphEntity[]>>> =
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
  doSave() {
    throw new Error('Method not implemented.');
  }

  ngOnChanges(changes: SimpleChanges) {
    this.change$.next(changes);
    super.ngOnChanges(changes);
  }

  ngOnDestroy() {
    this.change$.complete();
  }
}
