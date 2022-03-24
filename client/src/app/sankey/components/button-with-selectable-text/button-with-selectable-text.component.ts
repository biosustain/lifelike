import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button-with-selectable-text',
  templateUrl: './button-with-selectable-text.component.html',
  styleUrls: ['./button-with-selectable-text.component.scss']
})
export class ButtonWithSelectableTextComponent {
  @Input() disabled: boolean;
  @Input() title!: string;
}
