import { Component, Input } from '@angular/core';
import { AppUser } from '../../interfaces';

@Component({
  selector: 'app-user',
  template: `
    <ng-container *ngIf="user; else noUser">
      {{ user.firstName }} {{ user.lastName }}
    </ng-container>
    <ng-template #noUser>
      <em>Unknown</em>
    </ng-template>
  `,
})
export class UserComponent {

  @Input() user: AppUser;

}
