import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { PlacementArray } from '@ng-bootstrap/ng-bootstrap/util/positioning';
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-color-chooser-component',
  templateUrl: './color-chooser.component.html',
  styleUrls: [
    './color-chooser.component.scss',
  ],
})
export class ColorChooserComponent {
  @ViewChild('dropdown', {static: true, read: NgbDropdown}) dropdownComponent: NgbDropdown;
  @Input() color;
  @Input() placement: PlacementArray = 'bottom-left bottom-right top-left top-right';
  @Input() palette: string[] = [];
  @Input() emptyLabel = 'No Color';
  @Output() colorChange = new EventEmitter<string>();

  chooseColor(color) {
    this.color = color;
    this.dropdownComponent.close();
    this.colorChange.emit(this.color);
  }

  get effectiveColor() {
    const color = this.color;
    if (color === '' || color == null) {
      return null;
    } else {
      return color;
    }
  }
}
