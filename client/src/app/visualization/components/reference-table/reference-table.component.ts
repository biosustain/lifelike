import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

import { Subscription } from 'rxjs';

import { ReferenceTableRow } from 'app/interfaces';

import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';

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
