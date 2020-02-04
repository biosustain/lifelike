import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

import { Subscription } from 'rxjs';

import { ReferenceTableRow } from 'src/app/interfaces';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';
import { TooltipDetails } from '../../../shared/services/tooltip-control-service';
import { TooltipComponent } from 'src/app/shared/components/tooltip/tooltip.component';

// KG-17: Should consider creating a generalized parent class for tooltip menus,
// as it stands, the context menu and reference table components share a lot of code
@Component({
  selector: 'app-reference-table',
  templateUrl: './reference-table.component.html',
  styleUrls: ['./reference-table.component.scss']
})
export class ReferenceTableComponent extends TooltipComponent implements OnDestroy {
    @Input() tableNodes: ReferenceTableRow[];

    @Output() referenceTableRowClickEvent: EventEmitter<ReferenceTableRow>;

    hideReferenceTableSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private referenceTableControlService: ReferenceTableControlService,
    ) {
        super();

        this.hideReferenceTableSubscription = this.referenceTableControlService.hideTooltip$.subscribe(hideReferenceTable => {
            if (hideReferenceTable) {
                this.hideTooltip();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.referenceTableControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });

        this.referenceTableRowClickEvent = new EventEmitter<ReferenceTableRow>();
    }

    ngOnDestroy() {
        this.hideReferenceTableSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    openMetadataSidebarForNode(node: ReferenceTableRow) {
        this.referenceTableRowClickEvent.emit(node);
    }
}
