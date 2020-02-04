import { Component, Input, OnDestroy, Output, EventEmitter } from '@angular/core';

import { createPopper } from '@popperjs/core';

import { Subscription } from 'rxjs';

import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ContextMenuControlService } from '../../services/context-menu-control.service';

// TODO KG-17: Need to use Tippy so we can set a delay on the tooltip appearing for submenus
@Component({
    selector: 'app-context-menu',
    templateUrl: './context-menu.component.html',
    styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent extends TooltipComponent implements OnDestroy {
    @Input() selectedNodeEdgeLabels: Set<string>;

    @Output() groupNeighborsWithRelationship: EventEmitter<string> = new EventEmitter();

    subMenus: string[] = ['group-1-submenu'];

    hideContextMenuSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {
        super();

        this.hideContextMenuSubscription = this.contextMenuControlService.hideTooltip$.subscribe(hideContextMenu => {
            if (hideContextMenu) {
                this.hideTooltip();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.contextMenuControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });

        this.selectedNodeEdgeLabels = new Set<string>();
    }

    ngOnDestroy() {
        this.hideContextMenuSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    showGroupByRelSubMenu() {
        // TODO KG-17: It would be very cool if only the edges of the hovered relationship were highlighted
        this.hideAllSubMenus();

        const contextMenuItem = document.querySelector('#group-by-rel-menu-item');
        const tooltip = document.querySelector('#group-1-submenu') as HTMLElement;
        tooltip.style.display = 'block';
        // TODO KG-17: Probably don't want to make a new one of these every time...
        createPopper(contextMenuItem, tooltip, {
            modifiers: [
                {
                name: 'offset',
                options: {
                    offset: [0, 0],
                },
                },
            ],
            placement: 'right-start',
        });
    }

    hideAllSubMenus() {
        this.subMenus.forEach(subMenu => {
            const tooltip = document.querySelector(`#${subMenu}`) as HTMLElement;
            tooltip.style.display = 'none';
        });
    }

    requestGroupByRelationship(rel: string) {
        this.groupNeighborsWithRelationship.emit(rel);
    }

    // TODO KG-17: Would be cool to have a "Select Neighbors" feature on the context menu
}
