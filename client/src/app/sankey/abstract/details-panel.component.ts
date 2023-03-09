import { Component } from "@angular/core";

import { SankeySelectionService } from "../services/selection.service";
import { SelectionType } from "../interfaces/selection";

@Component({ template: "" })
export abstract class SankeyAbstractDetailsPanelComponent {
  SelectionType = SelectionType;
  details$ = this.selectionService.selection$;

  constructor(protected selectionService: SankeySelectionService) {}
}
