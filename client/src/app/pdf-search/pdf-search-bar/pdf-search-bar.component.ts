import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {PDFResult} from '../../interfaces';
import {SearchService} from '../../search/services/search.service';

@Component({
  selector: 'app-pdf-search-bar',
  templateUrl: './pdf-search-bar.component.html',
  styleUrls: ['./pdf-search-bar.component.scss']
})
export class PdfSearchBarComponent implements OnInit {
  @Output() results = new EventEmitter<any>();
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor(private searchService: SearchService) {
  }

  ngOnInit() {
  }

  onSubmit() {
    this.searchService.pdfFullTextSearch(
      this.searchForm.value.searchInput).subscribe((results) => {
      this.results.emit(results as PDFResult);
    });
  }



}
