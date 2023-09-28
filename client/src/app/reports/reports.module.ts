import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { CopyrightInfringementFormComponent } from './components/copyright-infringement-form.component';

@NgModule({
  imports: [SharedModule],
  declarations: [CopyrightInfringementFormComponent],
})
export class ReportsModule {}
