import { CdkDragDrop, CdkDropList, CdkDrag } from '@angular/cdk/drag-drop';
import { ElementRef } from '@angular/core';

export class DragDropEventFactory<T> {

   createInContainerEvent(containerId: string, data: T[], fromIndex: number, toIndex: number): CdkDragDrop<T[], T[]> {
      const event = this.createEvent(fromIndex, toIndex);
      const container: any = { id: containerId, data };
      event.container = container as CdkDropList<T[]>;
      event.previousContainer = event.container;
      event.item = { data: data[fromIndex] } as CdkDrag<T>;
      return event;
   }

   createCrossContainerEvent(from: ContainerModel<T>, to: ContainerModel<T>, element: HTMLElement): CdkDragDrop<T[], T[]> {
      const event = this.createEvent(from.index, to.index);
      event.container = this.createContainer(to);
      event.previousContainer = this.createContainer(from);
      event.item = { data: from.data[from.index] } as CdkDrag<T>;
      event.item.element = new ElementRef(element);
      return event;
   }

   private createEvent(previousIndex: number, currentIndex: number): CdkDragDrop<T[], T[]> {
      return {
         previousIndex,
         currentIndex,
         item: undefined,
         container: undefined,
         previousContainer: undefined,
         isPointerOverContainer: true,
         distance: { x: 0, y: 0 }
      };
   }

   private createContainer(model: ContainerModel<T>): CdkDropList<T[]> {
      const container: any = { id: model.id, data: model.data };
      return container as CdkDropList<T[]>;
   }
}

export interface ContainerModel<T> {
   id: string;
   data: T[];
   index: number;
}
