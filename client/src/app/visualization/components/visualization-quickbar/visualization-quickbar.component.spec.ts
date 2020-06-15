import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { VisualizationQuickbarComponent } from './visualization-quickbar.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('VisualizationQuickbarComponent', () => {
    let fixture: ComponentFixture<VisualizationQuickbarComponent>;
    let instance: VisualizationQuickbarComponent;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [
                VisualizationQuickbarComponent,
            ],
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VisualizationQuickbarComponent);
        instance = fixture.debugElement.componentInstance;
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });

    it('should emit a request to toggle the animation setting when the slide toggle is clicked', async () => {
        expect(instance.animationStatus).toBeTruthy();

        const animationToggleSpy = spyOn(instance, 'animationToggle').and.callThrough();
        const animationStatusSpy = spyOn(instance.animationStatus, 'emit');
        const slideToggleElement = document.getElementById('animation-slide-toggle');

        slideToggleElement.dispatchEvent(new Event('change'));

        fixture.detectChanges();
        await fixture.whenStable().then(() => {
            expect(animationToggleSpy).toHaveBeenCalled();
            expect(animationStatusSpy).toHaveBeenCalled();
        });
    });

    it('should emit a request to toggle the sidenav when the toggle sidenav button is clicked', () => {
        const toggleSidenavBtn = document.getElementById('toggle-sidenav-btn');
        const toggleDataSidenavSpy = spyOn(instance, 'toggleDataSidenav').and.callThrough();
        const toggleSidenavEmitSpy = spyOn(instance.toggleSidenav, 'emit');

        toggleSidenavBtn.click();
        fixture.detectChanges();

        expect(toggleDataSidenavSpy).toHaveBeenCalled();
        expect(toggleSidenavEmitSpy).toHaveBeenCalled();
    });
});
