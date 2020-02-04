import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

import { VirtualElement, Instance, createPopper } from '@popperjs/core';

import { Subscription } from 'rxjs';

import { ReferenceTableRow } from 'src/app/interfaces';

import { ReferenceTableControlService } from '../../services/reference-table-control.service';
import { TooltipDetails } from '../../services/tooltip-control-service';

// KG-17: Should consider creating a generalized parent class for tooltip menus,
// as it stands, the context menu and reference table components share a lot of code
@Component({
  selector: 'app-reference-table',
  templateUrl: './reference-table.component.html',
  styleUrls: ['./reference-table.component.scss']
})
export class ReferenceTableComponent implements OnInit, OnDestroy {
    @Input() tableNodes: ReferenceTableRow[];

    @Output() referenceTableRowClickEvent: EventEmitter<ReferenceTableRow>;

    virtualElement: VirtualElement;
    popper: Instance;
    referenceTable: HTMLElement;

    hideReferenceTableSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private referenceTableControlService: ReferenceTableControlService,
    ) {
        this.hideReferenceTableSubscription = this.referenceTableControlService.hideTooltip$.subscribe(hideReferenceTable => {
            if (hideReferenceTable) {
                this.hideMenu();
            } else {
                this.showMenu();
            }
        });

        this.updatePopperSubscription = this.referenceTableControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });

        this.referenceTableRowClickEvent = new EventEmitter<ReferenceTableRow>();
    }

    ngOnInit() {
        this.referenceTable = document.querySelector('#reference-table');
        this.setupPopper();
    }

    ngOnDestroy() {
        this.hideReferenceTableSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    generateRect(x = 0, y = 0) {
        return () => ({
            width: 0,
            height: 0,
            top: y,
            right: x,
            bottom: y,
            left: x,
        });
    }

    setupPopper() {
        this.virtualElement = {
            getBoundingClientRect: this.generateRect(),
        };
        this.popper = createPopper(this.virtualElement, this.referenceTable, {
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

    updatePopper(posX: number, posY: number) {
        this.virtualElement.getBoundingClientRect = this.generateRect(posX, posY);
        this.popper.update();
    }

    showMenu() {
        this.referenceTable.style.display = 'block';
    }

    hideMenu() {
        this.referenceTable.style.display = 'none';
    }

    openMetadataSidebarForNode(node: ReferenceTableRow) {
        this.referenceTableRowClickEvent.emit(node);
    }
}
