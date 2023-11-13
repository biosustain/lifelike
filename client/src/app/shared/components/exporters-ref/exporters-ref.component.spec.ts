import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';

import { ExportersRefComponent } from './exporters-ref.component';
import { ErrorHandler } from '../../services/error-handler.service';

describe('ExportersRefComponent', () => {
  let component: ExportersRefComponent;
  let fixture: ComponentFixture<ExportersRefComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ExportersRefComponent],
      providers: [
        ErrorHandler,
        FilesystemObjectActions,
        ObjectTypeService,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExportersRefComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
