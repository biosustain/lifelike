import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-search-control',
  templateUrl: './search-control.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: SearchControlComponent,
    multi: true,
  }],
})
export class SearchControlComponent implements ControlValueAccessor {

  value = '';
  private changeCallback: any;
  private touchCallback: any;

  @Input() disabled = false;
  @Input() resultIndex = 0;
  @Input() resultCount = 0;
  @Output() previous = new EventEmitter<number>();
  @Output() next = new EventEmitter<number>();
  @Output() enterPress = new EventEmitter();

  @ViewChild('searchInput', {static: false}) searchElement: ElementRef;

  changed() {
    if (this.changeCallback) {
      this.changeCallback(this.value);
    }
  }

  blurred() {
    if (this.touchCallback) {
      this.touchCallback();
    }
  }

  clear() {
    this.value = '';
    this.changed();
    this.focus();
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value): void {
    this.value = value;
  }

  focus() {
    this.searchElement.nativeElement.focus();
  }

  select() {
    this.searchElement.nativeElement.select();
  }

}
