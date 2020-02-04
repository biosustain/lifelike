import { Component, OnInit, Input } from '@angular/core';

import { VirtualElement, Instance, createPopper, Options } from '@popperjs/core';

@Component({
  selector: 'app-tooltip',
  template: '<div id="tooltip">I am a Tooltip</div>',
  styles: [],
})
export class TooltipComponent implements OnInit {
    @Input() tooltipSelector: string;
    @Input() tooltipOptions: Partial<Options>;

    virtualElement: VirtualElement;
    popper: Instance;
    tooltip: HTMLElement;

    constructor() {}

    ngOnInit() {
        this.tooltip = document.querySelector(this.tooltipSelector);
        this.setupPopper();
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
        this.popper = createPopper(this.virtualElement, this.tooltip, this.tooltipOptions);
    }

    updatePopper(posX: number, posY: number) {
        this.virtualElement.getBoundingClientRect = this.generateRect(posX, posY);
        this.popper.update();
    }

    showTooltip() {
        this.tooltip.style.display = 'block';
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
}
