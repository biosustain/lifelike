import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { AccountService } from 'app/users/services/account.service';
import { AdminGuard } from './services/admin-guard.service';

import { AdminPanelComponent } from './components/admin-panel.component';
import { UserCreateDialogComponent } from './components/user-create-dialog.component';
import { UserBrowserComponent } from './components/user-browser.component';

const components = [
  AdminPanelComponent,
  UserCreateDialogComponent,
  UserBrowserComponent,
];

@NgModule({
  entryComponents: [
    UserCreateDialogComponent,
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
