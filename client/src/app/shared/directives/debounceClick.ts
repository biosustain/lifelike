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
    selector: '[visClickDebounce]',
})
export class DebounceClickDirective implements OnInit {
    @Input() delay = 250;
    @Output() debounceClick: EventEmitter<string> = new EventEmitter();

    constructor(private el: ElementRef) {}

    ngOnInit() {
        const inputStream$ = fromEvent(this.el.nativeElement, 'click').pipe(
            map((e: any) => e.target.value),
            debounceTime(this.delay),
        );
        inputStream$.subscribe(e => {
            return this.debounceClick.emit(e);
        });
    }
}
