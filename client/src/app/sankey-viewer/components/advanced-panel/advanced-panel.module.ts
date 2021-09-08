import { NgModule } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { SankeyAdvancedPanelOptionComponent } from './advanced-panel-option.component';
import { SankeyAdvancedPanelComponent } from './advanced-panel.component';
import { FileBrowserModule } from '../../../file-browser/file-browser.module';
import { TYPE_PROVIDER } from '../../../file-browser/services/object-type.service';
import { SankeyTypeProvider } from '../../providers/sankey-type-provider';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    SankeyAdvancedPanelComponent,
    SankeyAdvancedPanelOptionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatDialogModule,
    MatChipsModule,
    MatSelectModule,
    MatInputModule,
    FlexLayoutModule,
    MatButtonModule,
    MatRadioModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
    NgbModule
  ],
  entryComponents: [],
  providers: [{
    provide: TYPE_PROVIDER,
    useClass: SankeyTypeProvider,
    multi: true,
  }],
  exports: [
    SankeyAdvancedPanelComponent
  ],
})
export class SankeyAdvancedPanelModule {
}
