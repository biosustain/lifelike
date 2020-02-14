import { NgModule } from '@angular/core';
import { DebounceInputDirective } from './debounceInput';

@NgModule({
    imports: [],
    declarations: [
        DebounceInputDirective,
    ],
    exports: [
        DebounceInputDirective,
    ]
})
export class SharedDirectivesModule { }
