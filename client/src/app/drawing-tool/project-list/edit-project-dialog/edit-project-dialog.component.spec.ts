import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditProjectDialogComponent } from './edit-project-dialog.component';

import { configureTestSuite } from 'ng-bullet';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';

describe('EditProjectDialogComponent', () => {
  let component: EditProjectDialogComponent;
  let fixture: ComponentFixture<EditProjectDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        imports: [
          DrawingToolModule,
        ]
      });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditProjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('should create', () => {
    expect(component).toBeTruthy();
  });
});
