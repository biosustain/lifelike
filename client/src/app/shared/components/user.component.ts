import { Component, Input } from '@angular/core';
import { AppUser } from '../../interfaces';

@Component({
  selector: 'app-user',
  template: `
    <ng-container *ngIf="user; else noUser">
      <span [ngbPopover]="infoPopover" popoverTitle="User Information" triggers="hover" container="body">
      {{ user.firstName }} {{ user.lastName }}
      </span>
    </ng-container>
    <ng-template #noUser>
      <em>Unknown</em>
    </ng-template>
    <ng-template #infoPopover>
      <strong>Username:</strong> {{ user.username }}
    </ng-template>
  `,
})
export class UserComponent {

  @Input() user: AppUser;

}
