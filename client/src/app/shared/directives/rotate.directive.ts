import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appRotate]'
})
export class RotateDirective {
  @HostBinding('style.transform') transform;
  @Input() set appRotate(value: number) {
    this.transform = value && `rotate(${value}deg)`;
  }
}
