import { Injectable } from '@angular/core';

import { BehaviorSubject, combineLatest } from 'rxjs';
import { first } from 'lodash-es';
import { map, first as rxjs_first, tap } from 'rxjs/operators';

import { SelectionType, SelectionEntity } from '../interfaces';
import { ControllerService } from './controller.service';

@Injectable()
export class SankeySelectionService {
  constructor(
    private sankeyController: ControllerService
  ) {
  }

  multiselect$ = new BehaviorSubject<boolean>(true);

  set multiselect(value: boolean) {
    this.multiselect$.next(value);
  }

  private _selection$ = new BehaviorSubject<SelectionEntity[]>([]);
  selection$ = combineLatest([
    this._selection$,
    this.multiselect$
  ]).pipe(
    map(([selection, multiselect]) => multiselect ? selection : first(selection) || {} as SelectionEntity)
  );

  toggleSelect(entity, type: SelectionType): Promise<void>|void {
    if (this.multiselect$.value) {
      return this._selection$.pipe(
        rxjs_first(),
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

          this._selection$.next(selection);
        })
      ).toPromise();
    } else {
      this._selection$.next([{
        type,
        entity
      }]);
    }
  }

  toggleNode(node) {
    return this.toggleSelect(node, SelectionType.node);
  }

  toggleLink(link) {
    return this.toggleSelect(link, SelectionType.link);
  }

  reset() {
    this._selection$.next([]);
  }
}
