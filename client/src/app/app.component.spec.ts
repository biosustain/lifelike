import { HttpClientModule } from '@angular/common/http';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrowserModule } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { ToolbarMenuModule } from 'toolbar-menu';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { RootStoreModule } from './root-store';
import { Neo4jModule } from './upload/neo4j.module';
import { VisualizationModule } from './visualization/visualization.module';

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let instance: AppComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RouterTestingModule,
                BrowserModule,
                AppRoutingModule,
                HttpClientModule,
                Neo4jModule,
                VisualizationModule,
                // ngrx
                RootStoreModule,
                VisualizationModule,
                ToolbarMenuModule,
            ],
            declarations: [
                AppComponent
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(AppComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create the app', () => {
        expect(fixture).toBeTruthy();
    });

    it(`should have as title 'client'`, () => {
        expect(instance.title).toEqual('client');
    });
});
