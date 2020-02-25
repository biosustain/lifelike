/**
 * The debounce directive is used as a way to throttle
 * the <input /> field as users type. A common use case
 * is making HTTP service requests on the user input
 * as they type.
 *
 *  Usage example:
 *      <input visDebounce (debounceCallback)="onChange($event)">
 *
 */
import {
    Directive,
    ElementRef,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';

import { fromEvent } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';

@Directive({
    selector: '[visDebounce]',
})
export class DebounceInputDirective implements OnInit {
    @Input() delay = 500;
    @Output() debounceCallback: EventEmitter<string> = new EventEmitter();

    constructor(private el: ElementRef) { }

    ngOnInit() {
        const inputStream$ = fromEvent(this.el.nativeElement, 'keyup').pipe(
            map((e: any) => e.target.value),
            debounceTime(this.delay),
        );
        inputStream$.subscribe((input: string) => {
            return this.debounceCallback.emit(input);
        });
    }
}
