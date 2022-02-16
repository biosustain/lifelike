import { Injectable } from '@angular/core';

import { ReplaySubject, BehaviorSubject } from 'rxjs';
import { compact } from 'lodash-es';
import { map, first } from 'rxjs/operators';

import { SelectionType, SelectionEntity } from '../interfaces';
import { ControllerService } from './controller.service';

@Injectable()
export class SankeySelectionService {
  constructor(
    private sankeyController: ControllerService
  ) {}

  selection$ = new BehaviorSubject<Array<any>>([]);
  selectedNodes$ = this.selection$.pipe(map(currentSelection => {
    return new Set(compact(currentSelection.map(e => e[SelectionType.node])));
  }));
  selectedLinks$ = this.selection$.pipe(map(currentSelection => {
    return new Set(compact(currentSelection.map(e => e[SelectionType.link])));
  }));
  selectionWithTraces$ = this.selection$.pipe(
    map((currentSelection) => {
      const nodes = compact(currentSelection.map(e => e[SelectionType.node]));
      const links = compact(currentSelection.map(e => e[SelectionType.link]));
      const traces = [
        ...this.sankeyController.getRelatedTraces({nodes, links})
      ].map(trace => ({[SelectionType.trace]: trace} as SelectionEntity));
      return [...currentSelection].reverse().concat(traces);
    })
  );

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
            [type]: entity
          } as SelectionEntity);
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
