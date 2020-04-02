import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { AuthenticationService } from './services/authentication.service';
import { LoginComponent } from './components/login.component';

const components = [
    LoginComponent,
];

@NgModule({
    imports: [SharedModule],
    declarations: components,
    providers: [AuthenticationService],
    exports: components,
})
export class AuthModule {}
