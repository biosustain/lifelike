import { NgModule } from '@angular/core';
import { DebounceInputDirective } from './debounceInput';
import { DebounceClickDirective } from './debounceClick';

@NgModule({
    imports: [],
    declarations: [
        DebounceClickDirective,
        DebounceInputDirective,
    ],
    exports: [
        DebounceClickDirective,
        DebounceInputDirective,
    ]
})
export class SharedDirectivesModule { }
