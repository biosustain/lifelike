/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// ngrx
import { EffectsModule } from '@ngrx/effects';

import { AngularMaterialModule } from './angular-material.module';
import { SharedDirectivesModule } from './directives/shareddirectives.module';
import { HighlightSnippetComponent } from './components/highlight-snippet/highlight-snippet.component';
import { LegendComponent } from './components/legend/legend.component';
import { NodeRelationshipComponent } from './components/node-relationship-display/node-relationship-display.component';
import { TooltipComponent } from './components/tooltip/tooltip.component';

import { SharedNgrxEffects } from './store/effects';
import { AngularSplitModule } from 'angular-split';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { HttpClientModule } from '@angular/common/http';
import { MessageDialogComponent } from './components/message-dialog/message-dialog.component';
import { ProgressDialogComponent } from './components/progress-dialog/progress-dialog.component';

const components = [
  MessageDialogComponent,
  ProgressDialogComponent,
  HighlightSnippetComponent,
  LegendComponent,
  NodeRelationshipComponent,
  TooltipComponent,
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
  declarations: components,
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
  ],
})
export class SharedModule {
}
