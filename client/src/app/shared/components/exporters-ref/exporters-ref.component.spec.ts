import { HttpClientModule } from '@angular/common/http';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { ExportersRefComponent } from './exporters-ref.component';
import { ErrorHandler } from '../../services/error-handler.service';

describe('ExportersRefComponent', () => {
  let component: ExportersRefComponent;
  let fixture: ComponentFixture<ExportersRefComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ExportersRefComponent],
      imports: [HttpClientModule, FileBrowserModule],
      providers: [ErrorHandler, ObjectTypeService],
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
