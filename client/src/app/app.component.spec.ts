import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { AppComponent } from './app.component';
import { RootStoreModule } from './***ARANGO_USERNAME***-store';

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let instance: AppComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RouterTestingModule,
                RootStoreModule,
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
