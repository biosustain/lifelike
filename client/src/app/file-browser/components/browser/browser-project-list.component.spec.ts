import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { FileTypesModule } from 'app/file-types/file-types.module';

import { BrowserProjectListComponent } from './browser-project-list.component';

describe('ProjectSpaceComponent', () => {
  let component: BrowserProjectListComponent;
  let fixture: ComponentFixture<BrowserProjectListComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        FileTypesModule,
        FileBrowserModule,
        RootStoreModule,
        RouterTestingModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BrowserProjectListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
