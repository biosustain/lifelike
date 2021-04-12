import { Component, Input } from '@angular/core';
import { EnrichWithGOTermsResult } from '../../../services/enrichment-visualisation.service';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupComponent {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() title;

  showMore = false;
  tabstatus;
  Infinity = Infinity;

  constructor() {
    this.tabstatus = {};
  }

  showMoreToggle() {
    this.showMore = !this.showMore;
  }
}
