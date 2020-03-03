import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { isNullOrUndefined } from 'util';

import { VisEdge, ReferenceTableRow, DuplicateNodeEdgePair } from 'app/interfaces';

import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { whichTransitionEvent } from 'app/shared/utils';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';

@Component({
  selector: 'app-reference-table',
  templateUrl: './reference-table.component.html',
  styleUrls: ['./reference-table.component.scss']
})
export class ReferenceTableComponent extends TooltipComponent implements OnDestroy, OnInit {
    @Input() set referenceTableData(tableData: DuplicateNodeEdgePair[]) {
        if (!isNullOrUndefined(tableData) && tableData.length > 0) {
            // Clear the table rows, because it is very likely that the on hover
            // delay will be shorter than the time it takes to get new data. (If
            // we don't do this we might see the old table for a brief moment).
            this.referenceTableRows = [];
            this.referenceTableControlService.getReferenceTableData(tableData);
        }
    }

    @Output() referenceTableRowClickEvent: EventEmitter<VisEdge>;

    referenceTableRows: ReferenceTableRow[] = [];

    FADEOUT_STYLE = 'reference-table fade-out';
    DEFAULT_STYLE = 'reference-table';

    referenceTableClass: string;
    subMenuClass: string;

    hideReferenceTableSubscription: Subscription;
    updatePopperSubscription: Subscription;
    referenceTableRowDataSubscription: Subscription;

    constructor(
        private referenceTableControlService: ReferenceTableControlService,
    ) {
        super();

        this.referenceTableClass = this.DEFAULT_STYLE;
        this.subMenuClass = this.DEFAULT_STYLE;

        this.hideReferenceTableSubscription = this.referenceTableControlService.hideTooltip$.subscribe(hideReferenceTable => {
            if (hideReferenceTable) {
                this.beginReferenceTableFade();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.referenceTableControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });

        this.referenceTableRowDataSubscription = this.referenceTableControlService.referenceTableRowData$.subscribe(result => {
            this.referenceTableRows = result.referenceTableRows.sort((a, b) => b.snippetCount - a.snippetCount);
        });

        this.referenceTableRowClickEvent = new EventEmitter<VisEdge>();
    }

    ngOnInit() {
        super.ngOnInit();
        this.setupFadeoutEndCallback();
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.hideReferenceTableSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    setupFadeoutEndCallback() {

        const element = document.getElementById('root-table');
        const animationEnd = whichTransitionEvent();
        element.addEventListener(animationEnd, () => {
            this.hideTooltip();
        }, false);
    }

    getAssociationsWithEdge(edge: VisEdge) {
        this.referenceTableRowClickEvent.emit(edge);
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.tooltip.style.display = 'block';
        this.referenceTableClass = this.DEFAULT_STYLE;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    beginReferenceTableFade() {
        // See setupFadeoutEndCallback for the fadeout animation end event
        this.referenceTableClass = this.FADEOUT_STYLE;
    }
}
