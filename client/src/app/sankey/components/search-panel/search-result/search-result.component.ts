import { Component, ElementRef, Input } from "@angular/core";

@Component({
  selector: "app-search-result",
  templateUrl: "./search-result.component.html",
  styleUrls: ["./search-result.component.scss"],
})
export class SearchResultComponent {
  @Input() result!: any;
  @Input() searchTokens!: any;
  @Input() focused: boolean;

  constructor(protected element: ElementRef) {}
}
