import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  OnDestroy,
  NgModule,
} from '@angular/core';

import { fromEvent, Subscription } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';

// TODO: not used?
@Directive({
  selector: '[appVisClickDebounce]',
})
export class DebounceClickDirective implements OnInit, OnDestroy {
  @Input() delay = 250;
  @Output() debounceClick: EventEmitter<string> = new EventEmitter();

  inputStreamSub: Subscription;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    const inputStream$ = fromEvent(this.el.nativeElement, 'click').pipe(
      map((e: any) => e.target.value),
      debounceTime(this.delay)
    );
    this.inputStreamSub = inputStream$.subscribe((e) => {
      return this.debounceClick.emit(e);
    });
  }

  ngOnDestroy() {
    this.inputStreamSub.unsubscribe();
  }
}

@NgModule({
  declarations: [DebounceClickDirective],
})
class NotUsedModule {
  /**
   * This module is not used anywhere.
   * It is declared to make the compiler happy.
   */
  constructor() {
    throw new Error('Not reachable');
  }
}
