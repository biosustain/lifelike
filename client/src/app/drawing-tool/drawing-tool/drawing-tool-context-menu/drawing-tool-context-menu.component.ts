import { Component, Input, Output, OnDestroy, EventEmitter } from '@angular/core';

import { Instance } from '@popperjs/core';

import { Subscription } from 'rxjs';

import { IdType } from 'vis-network';

import { DrawingToolContextMenuControlService } from 'app/drawing-tool/services/drawing-tool-context-menu-control.service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';
import { TooltipDetails } from 'app/shared/services/tooltip-control-service';

@Component({
  selector: 'app-drawing-tool-context-menu',
  templateUrl: './drawing-tool-context-menu.component.html',
  styleUrls: ['./drawing-tool-context-menu.component.scss']
})
export class DrawingToolContextMenuComponent extends TooltipComponent implements OnDestroy {
    @Input() selectedNodeIds: IdType[];
    @Input() selectedEdgeIds: IdType[];

    @Output() removeNodes: EventEmitter<IdType[]> = new EventEmitter();
    @Output() removeEdges: EventEmitter<IdType[]> = new EventEmitter();
    @Output() selectNeighbors: EventEmitter<IdType> = new EventEmitter();

    FADEOUT_STYLE = 'context-menu fade-out';
    DEFAULT_STYLE = 'context-menu';

    groupByRelSubmenuPopper: Instance;

    contextMenuClass: string;
    subMenuClass: string;

    subMenus: string[] = [];

    hideContextMenuSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private drawingToolContextMenuControlService: DrawingToolContextMenuControlService,
    ) {
        super();

        this.contextMenuClass = this.DEFAULT_STYLE;
        this.subMenuClass = this.DEFAULT_STYLE;

        this.hideContextMenuSubscription = this.drawingToolContextMenuControlService.hideTooltip$.subscribe(hideContextMenu => {
            if (hideContextMenu) {
                this.beginContextMenuFade();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.drawingToolContextMenuControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.hideContextMenuSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
        this.contextMenuClass = this.DEFAULT_STYLE;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    hideAllSubMenus() {
        this.subMenus.forEach(subMenu => {
            const tooltip = document.querySelector(`#${subMenu}`) as HTMLElement;
            tooltip.style.display = 'none';
        });
    }

    beginContextMenuFade() {
        this.contextMenuClass = this.FADEOUT_STYLE;
        this.beginSubmenuFade();
        setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }

    beginSubmenuFade() {
        this.subMenuClass = this.FADEOUT_STYLE;
    }

    requestEdgeRemoval() {
        this.removeEdges.emit(this.selectedEdgeIds);
        this.beginContextMenuFade();
    }

    requestNodeRemoval() {
        this.removeNodes.emit(this.selectedNodeIds);
        this.beginContextMenuFade();
    }

    requestNeighborSelection() {
        if (this.selectedNodeIds.length !== 1) {
            alert('Can only select neighbor nodes if exactly one node is selected!');
            return;
        }
        this.selectNeighbors.emit(this.selectedNodeIds[0]);
        this.beginContextMenuFade();
    }
}
