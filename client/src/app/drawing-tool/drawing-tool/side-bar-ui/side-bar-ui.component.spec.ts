import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_BASE_HREF } from '@angular/common';

import { SideBarUiComponent } from './side-bar-ui.component';
import { DrawingToolModule } from '../../drawing-tool.module';

describe('SideBarUiComponent', () => {
  let component: SideBarUiComponent;
  let fixture: ComponentFixture<SideBarUiComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        DrawingToolModule
      ],
      providers: [
        {provide: APP_BASE_HREF, useValue : '/' }
      ]
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
