import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { AutoClusterDialogComponent } from './auto-cluster-dialog.component';

describe('AutoClusterDialogComponent', () => {
    let instance: AutoClusterDialogComponent;
    let fixture: ComponentFixture<AutoClusterDialogComponent>;

    class MockMatDialogRef {
        close(data: any) {}
    }

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ AutoClusterDialogComponent ],
            imports: [
                RootStoreModule,
                SharedModule,
            ],
            providers: [
                { provide: MatDialogRef, useClass: MockMatDialogRef },
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        expandedNode: 1,
                        nodes: [],
                        edges: [],
                    },
                },
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(AutoClusterDialogComponent);
        instance = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(instance).toBeTruthy();
    });

    it('should call onNoClick if "No Thanks" button is clicked', () => {
        const noThanksButton = document.getElementById('auto-cluster-dialog-no-thanks-button');
        const onNoClickSpy = spyOn(instance, 'onNoClick');

        noThanksButton.click();

        expect(onNoClickSpy).toHaveBeenCalled();
    });

    it('should call onOkClick if "Yes Please" button is clicked', () => {
        const yesPleaseButton = document.getElementById('auto-cluster-dialog-yes-please-button');
        const onOkClickSpy = spyOn(instance, 'onOkClick');

        yesPleaseButton.click();

        expect(onOkClickSpy).toHaveBeenCalled();
    });

    it('should change the value of dontAskAgain if checkbox is clicked', async () => {
        expect(document.getElementsByClassName('mat-checkbox-input').length).toEqual(1);

        const dontAskAgainCheckbox = document.getElementsByClassName('mat-checkbox-input')[0] as HTMLElement;

        // The checkbox is unchecked on page load
        expect(instance.dontAskAgain).toBeUndefined();

        dontAskAgainCheckbox.click();

        fixture.detectChanges();
        await fixture.whenStable().then(() => {
            expect(instance.dontAskAgain).toBeTrue();

        });
    });
});
