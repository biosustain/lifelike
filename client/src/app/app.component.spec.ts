import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { AppComponent } from './app.component';
import { RootStoreModule } from './***ARANGO_USERNAME***-store';
import { SharedModule } from './shared/shared.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let instance: AppComponent;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
      ],
      declarations: [
        AppComponent
      ],
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    instance = fixture.debugElement.componentInstance;
  });

  it('should create the app', () => {
    expect(fixture).toBeTruthy();
  });
});
