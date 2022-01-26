import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { CookiePolicyComponent } from './components/cookie-policy.component';
import { PolicyViewerComponent } from './components/policy-viewer.component';
import { PolicyHostDirective } from './directives/policy-host.directive';
import { PrivacyPolicyComponent } from './components/privacy-policy.component';

const components = [
  CookiePolicyComponent,
  PolicyViewerComponent,
];
const directives = [
  PolicyHostDirective
];

@NgModule({
  declarations: [
    ...components,
    ...directives,
    PrivacyPolicyComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class PoliciesModule { }
