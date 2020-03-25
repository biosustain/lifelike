import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MockupModule } from '../../mockup.module';
import { InfoPanelComponent } from './info-panel.component';

describe('InfoPanelComponent', () => {
  let component: InfoPanelComponent;
  let fixture: ComponentFixture<InfoPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [ MockupModule ]
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
