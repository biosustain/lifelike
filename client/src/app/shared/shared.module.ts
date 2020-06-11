/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// ngrx
import { EffectsModule } from '@ngrx/effects';

import { AngularSplitModule } from 'angular-split';

import { AngularMaterialModule } from './angular-material.module';
import { HighlightSnippetComponent } from './components/highlight-snippet/highlight-snippet.component';
import { LegendComponent } from './components/legend/legend.component';
import { MessageDialogComponent } from './components/message-dialog/message-dialog.component';
import { NodeRelationshipComponent } from './components/node-relationship-display/node-relationship-display.component';
import { ProgressDialogComponent } from './components/progress-dialog/progress-dialog.component';
import { TooltipComponent } from './components/tooltip/tooltip.component';
import { SharedDirectivesModule } from './directives/shareddirectives.module';
import { SharedNgrxEffects } from './store/effects';
import {
  TruncatePipe,
  FriendlyDateStrPipe
} from './pipes';
import { NodeTextStylePipe } from './node-text-style.pipe';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

const components = [
  MessageDialogComponent,
  ProgressDialogComponent,
  HighlightSnippetComponent,
  LegendComponent,
  NodeRelationshipComponent,
  TooltipComponent,
  ConfirmDialogComponent,
];

@NgModule({
  entryComponents: [
    MessageDialogComponent,
    ProgressDialogComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule.forRoot(),
    DragDropModule,
    EffectsModule.forFeature([SharedNgrxEffects]),
    TextFieldModule,
  ],
  declarations: [
      ...components,
      TruncatePipe,
      FriendlyDateStrPipe,
      NodeTextStylePipe
  ],
  providers: [SharedNgrxEffects],
  // exported modules are visible to modules that import this one
  exports: [
    // Modules
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule,
    DragDropModule,
    TextFieldModule,
    // Components
    ...components,
    TruncatePipe,
    FriendlyDateStrPipe,
    NodeTextStylePipe
  ],
})
export class SharedModule {
}
