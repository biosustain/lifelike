import { Injectable } from '@angular/core';

import { BehaviorSubject, combineLatest } from 'rxjs';
import { isEqual, uniqBy, partialRight } from 'lodash-es';
import { map, first, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import { SelectionType, SelectionEntity } from '../interfaces';
import { ControllerService } from './controller.service';

@Injectable()
export class SankeySelectionService {
  constructor(
    private sankeyController: ControllerService
  ) {
  }

  selection$ = new BehaviorSubject<SelectionEntity[]>([]);
  selectedNodes$ = this.selectionByType(SelectionType.node);
  selectedLinks$ = this.selectionByType(SelectionType.link);

  selectedTraces$ = combineLatest([
    this.selectedNodes$,
    this.selectedLinks$
  ]).pipe(
    map(([nodes, links]) => this.sankeyController.getRelatedTraces({nodes, links})),
    distinctUntilChanged(isEqual),
    shareReplay(1)
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
    shareReplay(1)
  );

  selectionByType(type: SelectionType) {
    return this.selection$.pipe(
      map(selection =>
        selection
          .filter(s => s.type === type)
          .map(s => s.entity)
      ),
      map(partialRight(uniqBy, '_id')),
      distinctUntilChanged(isEqual),
      shareReplay(1)
    );
  }

  toggleSelect(entity, type: SelectionType) {
    return this.selection$.pipe(
      first(),
      map(selection => {
        const idxOfSelectedLink = selection.findIndex(
          d => d[type] === entity
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
