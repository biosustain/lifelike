import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReadPanelComponent } from './read-panel.component';

describe('ReadPanelComponent', () => {
  let component: ReadPanelComponent;
  let fixture: ComponentFixture<ReadPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReadPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReadPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
