import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { Subscription } from 'rxjs';

import { MAX_CLUSTER_ROWS } from 'app/constants';
import { SettingsFormValues, SettingsFormControl } from 'app/interfaces';

@Component({
  selector: 'app-visualization-settings',
  templateUrl: './visualization-settings.component.html',
  styleUrls: ['./visualization-settings.component.scss']
})
export class VisualizationSettingsComponent implements OnInit {
    @Input() legendLabels: string[];

    @Output() settingsFormChanges: EventEmitter<SettingsFormValues>;

    settingsForm: FormGroup;
    settingsFormValueChangesSub: Subscription;

    navbarCollapsed: boolean;

    constructor() {
        this.navbarCollapsed = true;

        this.settingsForm = new FormGroup({
            animation: new FormControl(true),
            maxClusterShownRows: new FormControl(
                MAX_CLUSTER_ROWS, [Validators.required, Validators.min(1), Validators.pattern(/^-?[0-9][^\.]*$/)]
            ),
        });

        this.settingsFormChanges = new EventEmitter<any>();
    }

    ngOnInit() {
        // Add a checkbox control for each element in the canvas legend (can't do this in the constructor since
        // the legendLabels input might not be initialized yet)
        this.legendLabels.forEach(label => {
            this.settingsForm.addControl(label, new FormControl(true));
        });

        // Emit the newly created settings form to the parent, so it can have the starting values initialized
        this.settingsFormChanges.emit(this.getSettingsFormValuesObject());

        this.settingsFormValueChangesSub = this.settingsForm.valueChanges.subscribe(() => {
            this.settingsFormChanges.emit(this.getSettingsFormValuesObject());
        });
    }

    /**
     * Gets the settings form values/validity as a SettingsFormValues object.
     */
    getSettingsFormValuesObject() {
        const settingsFormValues = {
            animation: {
                value: this.settingsForm.get('animation').value,
                valid: this.settingsForm.get('animation').valid,
            },
            maxClusterShownRows: {
                value: this.settingsForm.get('maxClusterShownRows').value,
                valid: this.settingsForm.get('maxClusterShownRows').valid,
            } as SettingsFormControl
        } as SettingsFormValues;

        this.legendLabels.forEach(label => {
            settingsFormValues[label] = {
                value: this.settingsForm.get(label).value,
                valid: this.settingsForm.get(label).valid,
            } as SettingsFormControl;
        });

        return settingsFormValues;
    }
}
