import { Directive, HostListener, Input } from '@angular/core';
import { URIData, GenericDataProvider } from '../providers/data-transfer-data/generic-data.provider';

@Directive({
  selector: '[appDataTransferData]',
})
export class DataTransferDataDirective {

  @Input() uriData: URIData[] = [];

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    GenericDataProvider.setURIs(event.dataTransfer, this.uriData, {replace: false});
  }

}
