import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DrawingToolModule } from '../../drawing-tool.module';
import { PaletteComponent } from './palette.component';
import { RootStoreModule } from 'app/root-store';

describe('PaletteComponent', () => {
  let component: PaletteComponent;
  let fixture: ComponentFixture<PaletteComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        DrawingToolModule
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PaletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
