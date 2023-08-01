import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { FormArrayWithFactory, FormGroupWithFactory } from 'app/shared/utils/form/with-factory';

@Component({
  selector: 'app-messages-control',
  templateUrl: './messages-control.component.html',
})
export class MessagesControlComponent {
  @HostBinding('class') @Input() class = 'form-group w-100';

  @Input() messagesControl: FormArrayWithFactory<
    FormGroup & {
      controls: {
        role: FormControl;
        content: FormControl;
        name: FormControl;
        functionCall: FormGroupWithFactory<FormControl>;
      };
    }
  >;

  @Input() roles: string[];
}
