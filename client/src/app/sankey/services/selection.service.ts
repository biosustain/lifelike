import { Injectable } from '@angular/core';

import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { isEqual, uniqBy } from 'lodash-es';
import { map, first, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import { debug } from 'app/shared/rxjs/debug';

import { SelectionType, SelectionEntity, SankeyNode, SankeyLink, SankeyTrace } from '../interfaces';
import { ControllerService } from './controller.service';

@Injectable()
export class SankeySelectionService {
  constructor(
    private sankeyController: ControllerService
  ) {
  }

  selection$ = new BehaviorSubject<SelectionEntity[]>([]);
  selectedNodes$ = this.selectionByType(SelectionType.node) as Observable<SankeyNode[]>;
  selectedLinks$  = this.selectionByType(SelectionType.link) as Observable<SankeyLink[]>;

  selectedTraces$ = combineLatest([
    this.selectedNodes$,
    this.selectedLinks$
  ]).pipe(
    map(([nodes, links]) => this.sankeyController.getRelatedTraces({nodes, links})),
    distinctUntilChanged(isEqual),
    debug('selectedTraces$'),
    shareReplay<SankeyTrace[]>(1)
  );

  selectionWithTraces$ = combineLatest([
    this.selection$,
    this.selectedTraces$
  ]).pipe(
    map(([selection, selectedTraces]) =>
      selection
        .concat(
          selectedTraces
            .map(entity => ({
              type: SelectionType.trace,
              entity
            }))
        )
    ),
    debug('selectionWithTraces$'),
    shareReplay(1)
  );

  selectionByType(type: SelectionType) {
    return this.selection$.pipe(
      map(selection =>
        selection
          .filter(s => s.type === type)
          .map(s => s.entity)
      ),
      map(n => uniqBy(n, '_id')),
      distinctUntilChanged(isEqual),
      debug(`selectionByType(${type})`),
      shareReplay(1)
    );
  }

  toggleSelect(entity, type: SelectionType) {
    return this.selection$.pipe(
      first(),
      map(selection => {
        const idxOfSelectedLink = selection.findIndex(
          d => d.entity === entity
        );

        if (idxOfSelectedLink !== -1) {
          selection.splice(idxOfSelectedLink, 1);
        } else {
          selection.unshift({
            type,
            entity
          });
        }

        this.selection$.next(selection);
      })
    );
  }

  toggleNode(node) {
    return this.toggleSelect(node, SelectionType.node);
  }

  toggleLink(link) {
    return this.toggleSelect(link, SelectionType.link);
  }

  resetSelection() {
    this.selection$.next([]);
  }
}
