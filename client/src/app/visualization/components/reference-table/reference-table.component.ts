import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';

import { NodeEdgePair, VisEdge } from 'app/interfaces';

import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';

@Component({
  selector: 'app-reference-table',
  templateUrl: './reference-table.component.html',
  styleUrls: ['./reference-table.component.scss']
})
export class ReferenceTableComponent extends TooltipComponent implements OnDestroy, OnInit {
    @Input() referenceTableData: NodeEdgePair[];

    @Output() referenceTableRowClickEvent: EventEmitter<VisEdge>;

    FADEOUT_STYLE = 'reference-table fade-out';
    DEFAULT_STYLE = 'reference-table';

    referenceTableClass: string;
    subMenuClass: string;

    hideReferenceTableSubscription: Subscription;
    updatePopperSubscription: Subscription;

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
        // Helper function to determine which event listener to use (dependent on browser)
        function whichTransitionEvent() {
            const el = document.createElement('fakeelement');
            const transitions = {
              animation: 'animationend',
              OAnimation: 'oAnimationEnd',
              MozAnimation: 'animationend',
              WebkitAnimation: 'webkitAnimationEnd',
            };

            for (const t in transitions) {
                if ( el.style[t] !== undefined ) {
                    return transitions[t];
                }
            }
        }
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
