import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectBrowserComponent } from './project-browser.component';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { RouterTestingModule } from '@angular/router/testing';

describe('ProjectSpaceComponent', () => {
  let component: ProjectBrowserComponent;
  let fixture: ComponentFixture<ProjectBrowserComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        FileBrowserModule,
        RootStoreModule,
        RouterTestingModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectBrowserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
