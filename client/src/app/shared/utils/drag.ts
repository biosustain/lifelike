import { Directive } from '@angular/core';
import { CdkDragMove, CdkDragRelease } from '@angular/cdk/drag-drop';

import { isNil, toPairs } from 'lodash-es';
import { Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';

import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { Tab } from '../workspace-manager';

export class DragImage {
  constructor(readonly image: HTMLElement,
              readonly x: number,
              readonly y: number) {
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    document.body.appendChild(this.image);
    dataTransfer.setDragImage(this.image, this.x, this.y);
    setTimeout(() => this.image.remove(), 500);
  }
}

export class CdkNativeDragItegration {
  constructor(
    private dragData$: Observable<Record<string, string>>
  ) {
  }

  lastTabDragTarget: Element = null;

  cdkDragMoved($event: CdkDragMove) {
    const dragTarget = document.elementFromPoint($event.pointerPosition.x, $event.pointerPosition.y);
    if (dragTarget !== this.lastTabDragTarget) {
      if (!isNil(this.lastTabDragTarget)) {
        const synthDragLeaveEvent = new DragEvent('dragleave');
        this.lastTabDragTarget.dispatchEvent(synthDragLeaveEvent);
      }
      const synthDragEnterEvent = new DragEvent('dragenter');
      dragTarget.dispatchEvent(synthDragEnterEvent);
      this.lastTabDragTarget = dragTarget;
    }
  }

  cdkDragReleased($event: CdkDragRelease<Tab>) {
    const dropRect = document.getElementsByClassName('cdk-drag-preview')[0].getBoundingClientRect();
    const dropTarget = document.elementFromPoint(dropRect.x + (dropRect.width / 2), dropRect.y + (dropRect.height / 2));
    const synthDropEvent = new DragEvent('drop', {dataTransfer: new DataTransfer()});

    return this.dragData$.pipe(
      first(),
      map(dragData => {
        toPairs(dragData).forEach(args => synthDropEvent.dataTransfer.setData(...args));
        return dropTarget.dispatchEvent(synthDropEvent);
      })
    ).toPromise();
  }
}
