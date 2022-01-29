import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpAndInfoComponent } from './help-and-info.component';

describe('HelpAndInfoComponent', () => {
  let component: HelpAndInfoComponent;
  let fixture: ComponentFixture<HelpAndInfoComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HelpAndInfoComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HelpAndInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
