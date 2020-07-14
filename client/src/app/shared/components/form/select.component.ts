import { Component, EventEmitter, HostBinding, Input, Output, ViewChild } from '@angular/core';
import { PlacementArray } from '@ng-bootstrap/ng-bootstrap/util/positioning';
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { ENTITY_TYPES } from '../../database';

let nextId = 0;

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
})
export class SelectComponent<T = any> {
  componentId = nextId++;
  @ViewChild('dropdown', {static: true, read: NgbDropdown}) dropdownComponent: NgbDropdown;
  @Input() formId: string;
  @Input() choices: T[] = [];
  selection: Set<T> = new Set();
  @Output() touch = new EventEmitter<any>();
  @Output() valuesChange = new EventEmitter<T[]>();
  @Input() placement: PlacementArray = 'bottom-left bottom-right top-left top-right';
  @Input() emptyLabel = 'None';
  @Input() allLabel = 'All';
  @Input() choiceLabel = choice => choice;

  @Input()
  set values(values: T[]) {
    this.selection = new Set<T>(values);
  }

  isAllSelected(): boolean {
    return this.choices.length === this.selection.size;
  }

  changeChoiceSelection(choice: T, value: boolean) {
    if (value) {
      this.selection.add(choice);
    } else {
      this.selection.delete(choice);
    }
    this.valuesChange.emit([...this.selection.values()]);
    this.touch.emit();
  }

  toggleAll(selected: boolean) {
    if (selected) {
      this.selection = new Set([...this.choices]);
    } else {
      this.selection.clear();
    }
    this.valuesChange.emit([...this.selection.values()]);
    this.touch.emit();
  }

  close() {
    this.dropdownComponent.close();
  }
}
