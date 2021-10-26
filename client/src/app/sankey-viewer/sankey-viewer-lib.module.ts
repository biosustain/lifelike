import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { TYPE_PROVIDER } from 'app/file-browser/services/object-type.service';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { GraphTypeProvider } from 'app/shared/providers/graph-type/graph-type-provider.service';
import { SharedSankeyModule } from 'app/shared-sankey/shared-sankey.module';

import { SankeyViewComponent } from './components/sankey-view.component';
import { SankeyModule } from './components/sankey/sankey.module';
import { SankeyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyDetailsPanelModule } from './components/details-panel/sankey-details-panel.module';
import { PathReportComponent } from './components/path-report/path-report.component';

@NgModule({
  declarations: [
    SankeyViewComponent,
    SankeyAdvancedPanelComponent,
    PathReportComponent
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
    SankeyDetailsPanelModule,
    SharedSankeyModule
  ],
  entryComponents: [],
  providers: [{
    provide: TYPE_PROVIDER,
    useClass: GraphTypeProvider,
    multi: true,
  }],
  exports: [
    SankeyViewComponent
  ],
})
export class SankeyViewerLibModule {
}
