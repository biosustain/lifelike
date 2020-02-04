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
    ],
    declarations: [],
    providers: [],
    // exported modules are visible to modules that import this one
    exports: [
        AngularMaterialModule,
        BrowserAnimationsModule,
        CommonModule,
        FlexLayoutModule,
        FormsModule,
        HttpClientModule,
        ReactiveFormsModule,
        RouterModule,
    ],
})

export class SharedModule {}
