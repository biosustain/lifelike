import {
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { SearchQuery } from 'app/interfaces';

@Component({
    selector: 'app-search-bar',
    templateUrl: './search-bar.component.html',
    styleUrls: ['./search-bar.component.scss'],
})
export class SearchBarComponent {

    @Input() query = '';
    @Input() error = '';
    @Output() search = new EventEmitter<SearchQuery>();

    searchForm = new FormGroup({
        searchInput: new FormControl(''),
    });

    constructor() {}

    onSubmit() {
        const query = {
            query: this.searchForm.value.searchInput,
            page: 1,
            limit: 10,
        } as SearchQuery;
        this.search.emit(query);
    }
}
