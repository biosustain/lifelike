import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { AuthenticationService } from './services/authentication.service';
import { LoginComponent } from './components/login.component';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { reducer } from './store/reducer';
import { AuthEffects } from './store/effects';

import { AuthGuard } from './guards/auth-guard.service';
import { LoginGuard } from './guards/login-guard.service';

const components = [
    LoginComponent,
];

@NgModule({
    imports: [
        EffectsModule.forFeature([AuthEffects]),
        StoreModule.forFeature('auth', reducer),
        SharedModule,
    ],
    declarations: components,
    providers: [
        AuthGuard,
        AuthenticationService,
        LoginGuard,
    ],
    exports: components,
})
export class AuthModule {}
