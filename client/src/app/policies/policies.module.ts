import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { CookiePolicyComponent } from './components/cookie-policy.component';
import { CopyrightInfringementPolicyComponent } from './components/copyright-infringement-policy.component';
import { PolicyViewerComponent } from './components/policy-viewer.component';
import { PolicyHostDirective } from './directives/policy-host.directive';
import { PrivacyPolicyComponent } from './components/privacy-policy.component';
import { TermsAndConditionsComponent } from './components/terms-and-conditions.component';

const exports = [
  CookiePolicyComponent,
  CopyrightInfringementPolicyComponent,

  PrivacyPolicyComponent,
  TermsAndConditionsComponent,
];

@NgModule({
  imports: [SharedModule],
  declarations: [PolicyViewerComponent, PolicyHostDirective, ...exports],
  exports,
})
export class PoliciesModule {}
