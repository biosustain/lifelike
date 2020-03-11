import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SideBarUiComponent } from './side-bar-ui.component';

describe('SideBarUiComponent', () => {
  let component: SideBarUiComponent;
  let fixture: ComponentFixture<SideBarUiComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SideBarUiComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SideBarUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
