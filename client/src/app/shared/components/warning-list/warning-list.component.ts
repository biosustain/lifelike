import { Component, Input } from "@angular/core";

import { WarningControllerService } from "app/shared/services/warning-controller.service";

@Component({
  selector: "app-warning-list",
  templateUrl: "warning-list.component.html",
})
export class WarningListComponent {
  @Input() showAll = false;
  @Input() dismissible = true;

  get warnings() {
    return this.showAll ? this.warningController.warnings : this.warningController.currentWarnings;
  }

  constructor(readonly warningController: WarningControllerService) {}

  close(warning) {
    return this.warningController.close(warning);
  }
}
