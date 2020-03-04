import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DrawingToolComponent } from './drawing-tool.component';

describe('DrawingToolComponent', () => {
  let component: DrawingToolComponent;
  let fixture: ComponentFixture<DrawingToolComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DrawingToolComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DrawingToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
