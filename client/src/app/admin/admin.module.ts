import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { AdminService } from './services/admin.service';

import { AdminPanelComponent } from './containers/admin-panel-page.component';
import { CreateUserComponent } from './containers/create-user.component';
import { ViewUsersComponent } from './containers/view-users.component';

const components = [
    AdminPanelComponent,
    CreateUserComponent,
    ViewUsersComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    providers: [AdminService],
    exports: components,
})
export class AdminModule {}
