import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectSpaceComponent } from './project-space.component';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { RootStoreModule } from 'app/root-store';

describe('ProjectSpaceComponent', () => {
  let component: ProjectSpaceComponent;
  let fixture: ComponentFixture<ProjectSpaceComponent>;

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
    fixture = TestBed.createComponent(ProjectSpaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
