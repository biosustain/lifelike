import {
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
    selector: 'app-search-bar',
    templateUrl: './search-bar.component.html',
    styleUrls: ['./search-bar.component.scss'],
})
export class SearchBarComponent {
    @Input() query = '';
    @Input() error = '';
    @Output() search = new EventEmitter<string>();

    searchForm = new FormGroup({
        searchInput: new FormControl(''),
    });

    constructor() {}

    onSubmit() {
        // No need to emit if the search bar is empty
        if (this.searchForm.value.searchInput !== '') {
            this.search.emit(this.searchForm.value.searchInput);
        }
    }
}
