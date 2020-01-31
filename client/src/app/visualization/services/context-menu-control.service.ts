import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';

export interface ContextMenuDetails {
  posX: number;
  posY: number;
}

@Injectable()
export class ContextMenuControlService {

  private hideContextMenuSource = new Subject<boolean>();
  private updatePopperSource = new Subject<ContextMenuDetails>();

  hideContextMenu$ = this.hideContextMenuSource.asObservable();
  updatePopper$ = this.updatePopperSource.asObservable();

  hideContextMenu() {
    this.hideContextMenuSource.next(true);
  }

  showContextMenu() {
    this.hideContextMenuSource.next(false);
  }

  updatePopper(posX: number, posY: number) {
    this.updatePopperSource.next({posX, posY});
  }

  constructor() { }
}
