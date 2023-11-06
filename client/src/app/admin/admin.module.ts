import { NgModule } from '@angular/core';

import {
  NgbAlert,
  NgbDropdownModule,
  NgbInputDatepickerConfig,
  NgbModalModule,
  NgbModule,
  NgbNavModule,
  NgbPaginationModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap/datepicker/datepicker.module';

import { SharedModule } from 'app/shared/shared.module';
import { AccountService } from 'app/users/services/account.service';

import { AdminGuard } from './services/admin-guard.service';
import { AnnotationTableComponent } from './components/annotations-table.component';
import { AdminPanelComponent } from './components/admin-panel.component';
import { AdminSettingsComponent } from './components/admin-settings.component';
import { UserCreateDialogComponent } from './components/user-create-dialog.component';
import { UserBrowserComponent } from './components/user-browser.component';
import { UserUpdateDialogComponent } from './components/user-update-dialog.component';
import { MissingRolesDialogComponent } from './components/missing-roles-dialog.component';
import { ChatgptUsageComponent } from './components/chatgpt-usage/chatgpt-usage.component';
import { DateTimePickerComponent } from './components/date-time-picker/date-time-picker.component';
import { PeriodPickerComponent } from './components/period-picker/period-picker.component';
import { ChatgptUsageGraphDirective } from './directives/chatgpt-usage-graph.directive';

const exports = [AdminPanelComponent];

@NgModule({
  entryComponents: [
    UserCreateDialogComponent,
    UserUpdateDialogComponent,
    MissingRolesDialogComponent,
  ],
  imports: [
    SharedModule,
    NgbDropdownModule,
    NgbAlert,
    NgbDatepickerModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbPaginationModule,
    NgbModalModule,
  ],
  declarations: [
    ChatgptUsageGraphDirective,
    DateTimePickerComponent,
    PeriodPickerComponent,
    ChatgptUsageComponent,
    AdminSettingsComponent,
    AnnotationTableComponent,
    UserCreateDialogComponent,
    UserBrowserComponent,
    UserUpdateDialogComponent,
    MissingRolesDialogComponent,
    ...exports,
  ],
  providers: [AdminGuard, AccountService],
  exports,
})
export class AdminModule {}
