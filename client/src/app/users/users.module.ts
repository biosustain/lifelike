import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

import { UserSettingsComponent } from './components/user-settings.component';
import { UserProfileComponent } from './components/user-profile.component';
import { UserSecurityComponent } from './components/user-security.component';


const components = [
    UserProfileComponent,
    UserSecurityComponent,
    UserSettingsComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    exports: components,
})
export class UserModule {}
