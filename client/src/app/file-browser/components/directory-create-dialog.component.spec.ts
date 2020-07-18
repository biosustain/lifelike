import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DirectoryCreateDialogComponent } from './directory-create-dialog.component';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('AddContentDialogComponent', () => {
  let component: DirectoryCreateDialogComponent;
  let fixture: ComponentFixture<DirectoryCreateDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        SharedModule,
        RootStoreModule
      ],
      declarations: [ DirectoryCreateDialogComponent ],
      providers: [
        NgbActiveModal
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DirectoryCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
