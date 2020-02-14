/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { NgModule } from '@angular/core';

// Sort alphabetically
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AngularMaterialModule } from './angular-material.module';
import { SharedDirectivesModule } from './directives/shareddirectives.module';

import { LegendComponent } from './components/legend/legend.component';
import { TooltipComponent } from './components/tooltip/tooltip.component';

const components = [
    LegendComponent,
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
    ],
    declarations: [TooltipComponent, LegendComponent],
    providers: [],
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
