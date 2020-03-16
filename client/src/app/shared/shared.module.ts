/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

// ngrx
import { EffectsModule } from '@ngrx/effects';

import { httpInterceptorProviders } from '../http-interceptors';

import { AngularMaterialModule } from './angular-material.module';
import { SharedDirectivesModule } from './directives/shareddirectives.module';

import { LegendComponent } from './components/legend/legend.component';
import { NodeRelationshipComponent } from './components/node-relationship-display/node-relationship-display.component';
import { TooltipComponent } from './components/tooltip/tooltip.component';

import { SharedNgrxEffects } from './store/effects';

const components = [
    LegendComponent,
    NodeRelationshipComponent,
    TooltipComponent,
];

@NgModule({
    imports: [
        AngularMaterialModule,
        BrowserAnimationsModule,
        CommonModule,
        FlexLayoutModule,
        FormsModule,
        HttpClientModule,
        ReactiveFormsModule,
        RouterModule,
        SharedDirectivesModule,

        EffectsModule.forFeature([SharedNgrxEffects]),
    ],
    declarations: components,
    providers: [httpInterceptorProviders, SharedNgrxEffects],
    // exported modules are visible to modules that import this one
    exports: [
        // Modules
        AngularMaterialModule,
        BrowserAnimationsModule,
        CommonModule,
        FlexLayoutModule,
        FormsModule,
        HttpClientModule,
        ReactiveFormsModule,
        RouterModule,
        SharedDirectivesModule ,
        // Components
        ...components,
    ],
})

export class SharedModule {}
