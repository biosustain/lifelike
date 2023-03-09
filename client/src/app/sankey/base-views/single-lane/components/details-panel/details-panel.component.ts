import { ChangeDetectorRef, Component, ViewEncapsulation } from "@angular/core";

import { map, tap } from "rxjs/operators";
import { defer, flatMap, uniq } from "lodash-es";

import { Trace } from "app/sankey/model/sankey-document";

import { SankeyAbstractDetailsPanelComponent } from "../../../../abstract/details-panel.component";
import { SankeySelectionService } from "../../../../services/selection.service";
import { SelectionEntity, SelectionType } from "../../../../interfaces/selection";
import { getNodeLinks } from "../../../multi-lane/utils";

@Component({
  selector: "app-sankey-single-lane-details-panel",
  templateUrl: "./details-panel.component.html",
  styleUrls: ["./details-panel.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class SankeySingleLaneDetailsPanelComponent extends SankeyAbstractDetailsPanelComponent {
  details$ = this.details$.pipe(
    map((selection: SelectionEntity) => {
      let tr: Trace[] = [];
      if (selection.type === SelectionType.node) {
        tr = uniq(flatMap(getNodeLinks(selection.entity), ({ traces }) => traces));
      }
      if (selection.type === SelectionType.link) {
        tr = uniq(selection.entity.traces);
      }
      return [selection, ...tr.map((entity) => ({ type: SelectionType.trace, entity }))];
    }),
    tap((selection) => defer(() => this.cdr.detectChanges()))
  );

  constructor(
    protected selectionService: SankeySelectionService,
    protected cdr: ChangeDetectorRef
  ) {
    super(selectionService);
  }
}
