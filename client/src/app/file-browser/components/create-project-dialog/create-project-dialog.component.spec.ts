import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateProjectDialogComponent } from './create-project-dialog.component';
import { configureTestSuite } from 'ng-bullet';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

describe('CreateProjectDialogComponent', () => {
  let component: CreateProjectDialogComponent;
  let fixture: ComponentFixture<CreateProjectDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ CreateProjectDialogComponent ],
      imports: [
        SharedModule,
        RootStoreModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateProjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
