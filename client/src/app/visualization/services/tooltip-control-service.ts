import { Injectable } from '@angular/core';

import { Subject, Observable } from 'rxjs';

export interface TooltipDetails {
  posX: number;
  posY: number;
}

@Injectable()
export class TooltipControlService {

    private hideTooltipSource = new Subject<boolean>();
    private updatePopperSource = new Subject<TooltipDetails>();

    hideTooltip$: Observable<boolean>;
    updatePopper$: Observable<TooltipDetails>;

    hideTooltip() {
        this.hideTooltipSource.next(true);
    }

    showTooltip() {
        this.hideTooltipSource.next(false);
    }

    updatePopper(posX: number, posY: number) {
        this.updatePopperSource.next({posX, posY});
    }

  constructor() {
        this.hideTooltip$ = this.hideTooltipSource.asObservable();
        this.updatePopper$ = this.updatePopperSource.asObservable();
   }
}
