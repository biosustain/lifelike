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
import { TYPE_PROVIDER } from '../file-browser/services/object-type.service';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { RouterModule } from '@angular/router';
import { SankeyViewComponent } from './components/sankey-view.component';
import { SankeyTypeProvider } from './providers/sankey-type-provider';
import { SankeyModule } from './components/sankey/sankey.module';
import { SankeyDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyAdvancedPanelModule } from './components/advanced-panel/advanced-panel.module';

@NgModule({
  declarations: [
    SankeyViewComponent,
    SankeyDetailsPanelComponent
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
    SankeyModule,
    SankeyAdvancedPanelModule,
  ],
  entryComponents: [],
  providers: [{
    provide: TYPE_PROVIDER,
    useClass: SankeyTypeProvider,
    multi: true,
  }],
  exports: [
    SankeyViewComponent,
    SankeyDetailsPanelComponent
  ],
})
export class SankeyViewerLibModule {
}
