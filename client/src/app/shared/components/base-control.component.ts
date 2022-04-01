import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-base-control',
  templateUrl: './base-control.component.html',
  styleUrls: ['./base-control.component.scss']
})
export class BaseControlComponent {
  @Input() disabled = false;
  @Input() resultIndex = 0;
  @Input() resultCount = 0;

  @Input() searching = false;
  @Output() previous = new EventEmitter<number>();
  @Output() next = new EventEmitter<number>();
  @Output() clear = new EventEmitter();
}
