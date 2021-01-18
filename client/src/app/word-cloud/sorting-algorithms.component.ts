import {Component, EventEmitter, Output, Input, ViewChild, ViewEncapsulation} from '@angular/core';
import {NgbDropdown} from '@ng-bootstrap/ng-bootstrap';
import {DefaultSortingAlgorithm, SortingAlgorithm, SortingAlgoritms} from "./sorting-algorithms";


@Component({
  selector: 'app-sorting-algorithms',
  templateUrl: './sorting-algorithms.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class SortingAlgorithmsComponent {
  @ViewChild('dropdown', {static: false, read: NgbDropdown}) dropdownComponent: NgbDropdown;
  @Output() changeSorting = new EventEmitter<SortingAlgorithm>();

  private algorithms: SortingAlgorithm[] = SortingAlgoritms;
  @Input() selected: SortingAlgorithm = DefaultSortingAlgorithm;
}
