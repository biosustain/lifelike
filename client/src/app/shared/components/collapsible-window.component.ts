import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-collapsible-window',
  templateUrl: './collapsible-window-component.html',
})
export class CollapsibleWindowComponent {
  @Input() title = 'Window';
  @Input() reversed = false;
  @Input() sideCollapse = false;
  @Input() borderless = false;
  expanded = true;

  collapse() {
    this.expanded = false;
  }

  expand() {
    this.expanded = true;
  }

  toggle() {
    this.expanded = !this.expanded;
  }
}
