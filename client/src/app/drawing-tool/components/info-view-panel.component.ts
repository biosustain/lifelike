import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import {
  first as _first,
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
import { Observable, ReplaySubject } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { SearchType } from 'app/search/shared';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphGroup,
  UniversalGraphNode,
} from '../services/interfaces';
import { getTermsFromGraphEntityArray } from '../utils/terms';

@Component({
  selector: 'app-info-view-panel',
  styleUrls: ['./map-editor/forms/entity-form.component.scss'],
  templateUrl: './info-view-panel.component.html',
})
export class InfoViewPanelComponent implements OnChanges, OnDestroy {
  constructor(protected readonly internalSearch: InternalSearchService) {}

  readonly change$ = new ReplaySubject<SimpleChanges>(1);
  readonly entities$: Observable<Set<string>> = this.change$.pipe(
    map(_pick(['selected', 'graphView'])),
    filter(_flow(_values, _some(Boolean))),
    startWith({}),
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
  private readonly temperature$: ReplaySubject<number> = new ReplaySubject(1);

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

  @Input() graphView: CanvasGraphView;
  @Input() selected: GraphEntity[];
  // Return entity if there is only one selected, otherwise return undefined
  one: { typeLabel: string; name: string; isNode: boolean } & GraphEntity;

  ngOnChanges(changes: SimpleChanges) {
    this.change$.next(changes);

    if (changes.selected) {
      if (this.selected.length === 1) {
        const selected = _first(this.selected);
        this.one = {
          ...selected,
          typeLabel: this.typeLabel(selected),
          name: this.name(selected),
          isNode: this.isNode(selected),
        };
      } else {
        this.one = undefined;
      }
    }
  }

  ngOnDestroy() {
    this.change$.complete();
  }

  private isNode({ type }: GraphEntity) {
    return type === GraphEntityType.Node;
  }

  private name({ type, entity }: GraphEntity): string {
    if (type === GraphEntityType.Node) {
      const node = entity as UniversalGraphNode;
      return node.display_name;
    } else if (type === GraphEntityType.Edge) {
      const edge = entity as UniversalGraphEdge;
      return edge.label;
    } else if (type === GraphEntityType.Group) {
      const group = entity as UniversalGraphGroup;
      return group.display_name;
    } else {
      return '?unknown entity type?';
    }
  }

  private typeLabel({ type, entity }: GraphEntity): string {
    if (type === GraphEntityType.Node) {
      return (entity as UniversalGraphNode).label;
    } else if (type === GraphEntityType.Edge) {
      return 'connection';
    } else if (type === GraphEntityType.Group) {
      return 'group';
    } else {
      return 'unknown';
    }
  }

  searchMapNodeInVisualizer(node) {
    return this.internalSearch.visualizer_tmp_fix(node.display_name, {
      entities: [node.label],
    });
  }

  searchMapNodeInContent(node, type: SearchType | string) {
    return this.internalSearch.fileContents(node.display_name, { types: [type] });
  }
}
