import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { EffectsModule } from '@ngrx/effects';

import { AccountService } from './services/account.service';
import { UserSettingsComponent } from './components/user-settings.component';
import { UserProfileComponent } from './components/user-profile.component';
import { UserSecurityComponent } from './components/user-security.component';

import { UserEffects } from './store/effects';
import { TermsOfServiceDialogComponent } from './components/terms-of-service-dialog.component';
import { TermsOfServiceComponent } from './components/terms-of-service.component';
import { TermsOfServiceTextComponent } from './components/terms-of-service-text.component';

const components = [
  UserProfileComponent,
  UserSecurityComponent,
  UserSettingsComponent,
  TermsOfServiceTextComponent,
  TermsOfServiceDialogComponent,
  TermsOfServiceComponent,
];

@NgModule({
  imports: [
    EffectsModule.forFeature([UserEffects]),
    SharedModule,
  ],
  declarations: components,
  providers: [AccountService],
  entryComponents: [TermsOfServiceDialogComponent],
  exports: components,
})
export class UserModule {
}
