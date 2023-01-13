import { ChangeDetectorRef, Component, ViewEncapsulation } from '@angular/core';

import { tap, map } from 'rxjs/operators';
import { groupBy, defer, mapValues } from 'lodash-es';

import { SankeyAbstractDetailsPanelComponent } from '../../../../abstract/details-panel.component';
import { SankeySelectionService } from '../../../../services/selection.service';
import { SelectionEntity, SelectionType } from '../../../../interfaces/selection';
import { getTraces } from '../../utils';

@Component({
  selector: 'app-sankey-multi-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SankeyMutiLaneDetailsPanelComponent extends SankeyAbstractDetailsPanelComponent {
  constructor(
    protected selectionService: SankeySelectionService,
    protected cdr: ChangeDetectorRef
  ) {
    super(selectionService);
  }

  details$ = this.details$.pipe(
    map((selection: SelectionEntity[]) => {
      const { [SelectionType.node]: nodes, [SelectionType.link]: links } = mapValues(
        groupBy(selection, 'type'),
        (selectionGroup) => selectionGroup.map(({ entity }) => entity)
      );
      return [
        ...selection,
        ...getTraces({ nodes, links } as any).map((entity) => ({
          type: SelectionType.trace,
          entity,
        })),
      ] as SelectionEntity[];
    }),
    tap((selection) => defer(() => this.cdr.detectChanges()))
  );
}
