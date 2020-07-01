import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditProjectDialogComponent } from './edit-project-dialog.component';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

describe('EditProjectDialogComponent', () => {
  let component: EditProjectDialogComponent;
  let fixture: ComponentFixture<EditProjectDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        FileBrowserModule,
        RootStoreModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditProjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
