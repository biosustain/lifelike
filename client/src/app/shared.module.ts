/**
 * Commonly-used imports are grouped here for simplier use by feature modules.
 */
import { NgModule } from '@angular/core';

// Sort alphabetically
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';


import { AngularMaterialModule } from './angular-material.module';

@NgModule({
    imports: [
        BrowserAnimationsModule,
        CommonModule,
        FormsModule,
        HttpClientModule,
        AngularMaterialModule,
        ReactiveFormsModule,
        RouterModule,
    ],
    declarations: [],
    providers: [],
    // exported modules are visible to modules that import this one
    exports: [
        BrowserAnimationsModule,
        CommonModule,
        FormsModule,
        HttpClientModule,
        AngularMaterialModule,
        ReactiveFormsModule,
        RouterModule,
    ],
})

export class SharedModule {}
