import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { AccountService } from 'app/users/services/account.service';
import { AdminGuard } from './services/admin-guard.service';

import { AdminPanelComponent } from './components/admin-panel.component';
import { UserCreationDialogComponent } from './components/user-creation-dialog.component';
import { UsersViewComponent } from './components/users-view.component';

const components = [
  AdminPanelComponent,
  UserCreationDialogComponent,
  UsersViewComponent,
];

@NgModule({
  entryComponents: [
    UserCreationDialogComponent,
  ],
  imports: [
    SharedModule,
  ],
  declarations: components,
  providers: [
    AdminGuard,
    AccountService,
  ],
  exports: components,
})
export class AdminModule {
}
