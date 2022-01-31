import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CopyrightInfringementFormComponent } from './copyright-infringement-form.component';

describe('CopyrightInfringementFormComponent', () => {
  let component: CopyrightInfringementFormComponent;
  let fixture: ComponentFixture<CopyrightInfringementFormComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CopyrightInfringementFormComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CopyrightInfringementFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
