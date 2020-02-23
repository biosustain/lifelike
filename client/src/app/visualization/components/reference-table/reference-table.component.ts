import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

import { Instance, createPopper } from '@popperjs/core';

import { Subscription } from 'rxjs';
import { filter, first, switchMap, take} from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { GetEdgeSnippetCountsResult, ReferenceTableRow, VisEdge } from 'app/interfaces';

import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';

/**
 * TODO: Sometimes getting this error from Popper in the console:
 *
 * index.js:218 Popper: Invalid reference or popper argument provided to Popper,
 * they must be either a valid DOM element, virtual element, or a jQuery-wrapped DOM element.
 *
 * The cause of this is unclear, but it seems to sometimes occur when the reference table has
 * been shown multiple times.
 */

@Component({
  selector: 'app-reference-table',
  templateUrl: './reference-table.component.html',
  styleUrls: ['./reference-table.component.scss']
})
export class ReferenceTableComponent extends TooltipComponent implements OnDestroy {
    @Input() nodeTable: ReferenceTableRow[];

    @Output() referenceTableRowClickEvent: EventEmitter<VisEdge>;

    FADEOUT_STYLE = 'reference-table fade-out';
    DEFAULT_STYLE = 'reference-table';

    edgeLabelSubmenuPopper: Instance;

    referenceTableClass: string;
    subMenuClass: string;

    subMenus: string[] = ['selected-node-edge-labels-submenu'];

    getEdgeSnippetCountsResult: GetEdgeSnippetCountsResult;

    hideReferenceTableSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private referenceTableControlService: ReferenceTableControlService,
    ) {
        super();

        this.referenceTableClass = this.DEFAULT_STYLE;
        this.subMenuClass = this.DEFAULT_STYLE;

        this.getEdgeSnippetCountsResult = null;

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

        this.referenceTableRowClickEvent = new EventEmitter<VisEdge>();
    }

    ngOnDestroy() {
        this.hideReferenceTableSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    getAssociationsWithEdge(edge: VisEdge) {
        this.referenceTableRowClickEvent.emit(edge);
    }

    // TODO: Need to have an interrupt event if a user hovers away from the cluster node before the reference table can be shown.
    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
        this.referenceTableClass = this.DEFAULT_STYLE;
    }

    // TODO: It seems like the "flipping" behavior handled by popper is somewhat inconsistent,
    // it should be flipping the edge label submenu when it first appears if it is too close to
    // the right edge of the viewport, but it isn't. It does flip on subsequent renders, which is
    // odd because we destroy the submenu popper before creating a new one, so I would expect
    // consistent behavior. Could be a popper bug, but it is curious that this is not happening
    // with the other tooltips (at least not consistently enough to be noticeable)
    showSelectedNodeEdgeLabels(referenceTableRow: ReferenceTableRow) {
        this.hideAllSubMenus();
        this.referenceTableControlService.delayEdgeMenu();
        this.referenceTableControlService.showReferenceTableResult$.pipe(
            first(),
            filter((showReferenceTable) => {
                if (showReferenceTable) {
                    this.referenceTableControlService.getAssociationCountForEdges(referenceTableRow.edges);
                }
                return showReferenceTable;
            }),
            switchMap(() => this.referenceTableControlService.associationCountForEdges$)
        ).pipe(take(1)).subscribe((result) => {
            this.getEdgeSnippetCountsResult = result;

            const referenceTableItem = document.querySelector(`#reference-table-node-${referenceTableRow.node.id}`);
            const tooltip = document.querySelector('#selected-node-edge-labels-submenu') as HTMLElement;
            tooltip.style.display = 'block';

            if (!isNullOrUndefined(this.edgeLabelSubmenuPopper)) {
                this.edgeLabelSubmenuPopper.destroy();
                this.edgeLabelSubmenuPopper = null;
            }
            this.edgeLabelSubmenuPopper = createPopper(referenceTableItem, tooltip, {
                placement: 'right-start',
            });
        });
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    hideAllSubMenus() {
        this.referenceTableControlService.interruptEdgeMenu();
        this.subMenus.forEach(subMenu => {
            const tooltip = document.querySelector(`#${subMenu}`) as HTMLElement;
            tooltip.style.display = 'none';
        });
    }

    beginReferenceTableFade() {
        this.referenceTableClass = this.FADEOUT_STYLE;
        this.beginSubmenuFade();
        setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }

    beginSubmenuFade() {
        this.subMenuClass = this.FADEOUT_STYLE;
    }

    mouseLeaveNodeRow() {
        // Interrupt showing the submenu if the user hovers away from a node
        this.referenceTableControlService.interruptEdgeMenu();
    }
}
