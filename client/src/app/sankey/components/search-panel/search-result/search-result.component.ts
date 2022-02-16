import { Component, OnInit, Input, ElementRef } from '@angular/core';

@Component({
  selector: 'app-search-result',
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent {
  constructor(protected element: ElementRef) {}
  @Input() result!: any;
  @Input() searchTokens!: any;
  @Input() focused: boolean;
}
