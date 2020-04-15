import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { EffectsModule } from '@ngrx/effects';

import { AccountService } from './services/account.service';
import { UserSettingsComponent } from './components/user-settings.component';
import { UserProfileComponent } from './components/user-profile.component';
import { UserSecurityComponent } from './components/user-security.component';

import { UserEffects } from './store/effects';

const components = [
    UserProfileComponent,
    UserSecurityComponent,
    UserSettingsComponent,
];

@NgModule({
    imports: [
        EffectsModule.forFeature([UserEffects]),
        SharedModule,
    ],
    declarations: components,
    providers: [AccountService],
    exports: components,
})
export class UserModule {}
