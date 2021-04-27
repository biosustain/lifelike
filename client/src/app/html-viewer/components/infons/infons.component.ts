import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-html-infons',
  templateUrl: './infons.component.html',
  styleUrls: ['./infons.component.scss'],
})
export class InfonsComponent {
  @Input() data;
}
