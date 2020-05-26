import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { TermsOfServiceDialogComponent } from './terms-of-service-dialog.component';
import { SharedModule } from 'app/shared/shared.module';

describe('TermsOfServiceDialogComponent', () => {
  let component: TermsOfServiceDialogComponent;
  let fixture: ComponentFixture<TermsOfServiceDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        declarations: [
            TermsOfServiceDialogComponent,
        ],
        imports: [
            SharedModule,
        ]
      });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TermsOfServiceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('should create', () => {
    expect(component).toBeTruthy();
  });
});
