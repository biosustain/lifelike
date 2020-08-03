import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('CreateProjectDialogComponent', () => {
  let component: ProjectCreateDialogComponent;
  let fixture: ComponentFixture<ProjectCreateDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ ProjectCreateDialogComponent ],
      imports: [
        SharedModule,
        RootStoreModule
      ],
      providers: [
        NgbActiveModal
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
