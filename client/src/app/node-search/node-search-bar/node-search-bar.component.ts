import {Component, EventEmitter, Output} from '@angular/core';
import {FormControl} from '@angular/forms';

@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent {
  @Output() searchTermChange = new EventEmitter<string>();
  searchInput = new FormControl('');

  onSubmit() {
    const searchTerm: string = this.searchInput.value;
    this.searchTermChange.emit(searchTerm);
  }
}
