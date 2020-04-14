import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DrawingToolModule } from '../../drawing-tool.module';
import { InfoPanelComponent } from './info-panel.component';

xdescribe('InfoPanelComponent', () => {
  let component: InfoPanelComponent;
  let fixture: ComponentFixture<InfoPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [ DrawingToolModule ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InfoPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
