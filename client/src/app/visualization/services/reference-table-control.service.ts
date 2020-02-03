import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ReferenceTableDetails {
    posX: number;
    posY: number;
  }

@Injectable()
export class ReferenceTableControlService {
  constructor() { }

  private hideReferenceTableSource = new Subject<boolean>();
  private updatePopperSource = new Subject<ReferenceTableDetails>();

  hideReferenceTable$ = this.hideReferenceTableSource.asObservable();
  updatePopper$ = this.updatePopperSource.asObservable();

  hideReferenceTable() {
    this.hideReferenceTableSource.next(true);
  }

  showReferenceTable() {
    this.hideReferenceTableSource.next(false);
  }

  updatePopper(posX: number, posY: number) {
    this.updatePopperSource.next({posX, posY});
  }

}
