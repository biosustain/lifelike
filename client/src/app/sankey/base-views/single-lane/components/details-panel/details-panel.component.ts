import { Component, ViewEncapsulation, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { map, tap } from 'rxjs/operators';
import { defer, uniq, flatMap } from 'lodash-es';

import { SankeyNode, SankeyLink, SankeyTraceLink, Trace } from 'app/sankey/model/sankey-document';

import { SankeyAbstractDetailsPanelComponent } from '../../../../abstract/details-panel.component';
import { SankeySelectionService } from '../../../../services/selection.service';
import { SelectionEntity, SelectionType } from '../../../../interfaces/selection';
import { getTraces, getNodeLinks } from '../../../multi-lane/utils';

@Component({
  selector: 'app-sankey-single-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySingleLaneDetailsPanelComponent extends SankeyAbstractDetailsPanelComponent {
  constructor(
    protected selectionService: SankeySelectionService,
    protected cdr: ChangeDetectorRef
  ) {
    super(selectionService);
  }

  details$ = this.details$.pipe(
    map((selection: SelectionEntity) => {
      let tr: Trace[] = [];
      if (selection.type === SelectionType.node) {
        tr = uniq(flatMap(getNodeLinks(selection.entity), ({traces}) => traces));
      }
      if (selection.type === SelectionType.link) {
        tr = uniq(selection.entity.traces);
      }
      return [
        selection, ...tr.map(entity => ({type: SelectionType.trace, entity}))
      ];
    }),
    tap(selection => defer(() => this.cdr.detectChanges()))
  );
}
