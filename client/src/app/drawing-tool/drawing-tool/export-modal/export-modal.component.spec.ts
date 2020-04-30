import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportModalComponent } from './export-modal.component';
import { DrawingToolModule } from '../../drawing-tool.module';
import { MatDialogRef} from '@angular/material/dialog';
import {configureTestSuite} from 'ng-bullet';
import {RootStoreModule} from "../../../root-store";

describe('ExportModalComponent', () => {
  let component: ExportModalComponent;
  let fixture: ComponentFixture<ExportModalComponent>;

  configureTestSuite(() => {
      TestBed.configureTestingModule({
          imports: [
            DrawingToolModule,
            RootStoreModule
          ],
          providers: [{
             provide: MatDialogRef,
             useValue: {}
          }]
      });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
