import { Component, Input } from '@angular/core';

import { SankeyAbstractDetailsComponent } from '../../abstract/details-panel.component';


@Component({
  selector: 'app-button-with-selectable-text',
  templateUrl: './button-with-selectable-text.component.html',
  styleUrls: ['./button-with-selectable-text.component.scss']
})
// @ts-ignore
export class ButtonWithSelectableTextComponent extends SankeyAbstractDetailsComponent {
  @Input() disabled;
}
