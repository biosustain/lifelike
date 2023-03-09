/**
 * The debounce directive is used as a way to throttle
 * the <input /> field as users type. A common use case
 * is making HTTP service requests on the user input
 * as they type.
 *
 *  Usage example:
 *      <input appVisDebounce (debounceCallback)="onChange($event)">
 *
 */
import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";

import { fromEvent, Subscription } from "rxjs";
import { debounceTime, map } from "rxjs/operators";

@Directive({
  selector: "[appVisDebounce]",
})
export class DebounceInputDirective implements OnInit, OnDestroy {
  @Input() delay = 500;
  @Output() debounceCallback: EventEmitter<string> = new EventEmitter();
  inputStreamSub: Subscription;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    const inputStream$ = fromEvent(this.el.nativeElement, "keyup").pipe(
      map((e: any) => e.target.value),
      debounceTime(this.delay)
    );
    this.inputStreamSub = inputStream$.subscribe((input: string) => {
      return this.debounceCallback.emit(input);
    });
  }

  ngOnDestroy() {
    this.inputStreamSub.unsubscribe();
  }
}
