import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupComponent {
  @Input() data;
  @Input() title;

  showMore = false;

  showMoreToggle() {
    this.showMore = !this.showMore;
  }
}
