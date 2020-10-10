import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { uniqueId } from 'lodash';

import { isNullOrUndefined } from 'util';

import { AnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';


@Component({
  selector: 'app-annotation-filter',
  templateUrl: './annotation-filter.component.html',
  styleUrls: ['./annotation-filter.component.scss']
})
export class AnnotationFilterComponent implements OnInit {
  id = uniqueId('AnnotationFilterComponent-');

  @Input() annotationData: AnnotationFilterEntity[];
  @Output() wordVisibilityOutput: EventEmitter<Map<string, boolean>>;

  wordVisibilityMap: Map<string, boolean>;
  wordVisibilityChanged: boolean;

  form: FormGroup;

  minimumFrequencyInputId: string;
  maximumFrequencyInputId: string;

  constructor() {
    this.wordVisibilityMap = new Map<string, boolean>();

    this.form = new FormGroup(
      // Form controls
      {
        minimumFrequency: new FormControl(
          0, [Validators.required, Validators.min(0), Validators.pattern(/^-?[0-9][^\.]*$/)]
        ),
        maximumFrequency: new FormControl(
          0, [Validators.required, Validators.min(0), Validators.pattern(/^-?[0-9][^\.]*$/)]
        ),
      },
      // Form group validators
      [this.minMaxFreqValidator()]
    );

    this.minimumFrequencyInputId = `${this.id}-mininum-frequency-input`;
    this.maximumFrequencyInputId = `${this.id}-maximum-frequency-input`;

    this.wordVisibilityOutput = new EventEmitter<Map<string, boolean>>();
  }

  ngOnInit() {
    // The very first time we get the annotationData, set the default values for the frequency filters
    this.form.get('minimumFrequency').setValue(1);
    this.form.get('maximumFrequency').setValue(this.annotationData[0].frequency);

    // Also set the visibility of each annotation to true
    this.annotationData.forEach(annotation => {
      this.wordVisibilityMap.set(annotation.text, true);
    });
  }

  submit() {
    if (this.form.valid) {
      this.applyFiltersAndGroupings();
      this.wordVisibilityOutput.emit(this.wordVisibilityMap);
    }
  }

  isWordVisible(word: string) {
    const value = this.wordVisibilityMap.get(word);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  /**
   * Changes the filter state of the given word to the given input state.
   * @param word string representing the word to change the state of
   * @param event checkbox event object containing the new state
   */
  changeWordVisibility(word: string, event) {
    this.wordVisibilityMap.set(word, event.target.checked);
    this.invalidateWordVisibility();
    this.wordVisibilityOutput.emit(this.wordVisibilityMap);
  }

  /**
   * Sets all words in the word visibility map to the input state.
   * @param state boolean true/false representing a filter state for the word cloud
   */
  setAllWordsVisibility(state: boolean) {
    for (const annotation of this.annotationData) {
      this.wordVisibilityMap.set(annotation.text, state);
    }
    this.invalidateWordVisibility();
    this.wordVisibilityOutput.emit(this.wordVisibilityMap);
  }

  /**
   * Determines whether any words in the word cloud have been filtered. By default words are not filtered, so if any of them are, then we
   * know that the user changed the filter. We use this to determine which (if any) of the buttons on the widget to disable/enable.
   */
  private invalidateWordVisibility() {
    // Keep track if the user has some entity types disabled
    let wordVisibilityChanged = false;
    for (const value of this.wordVisibilityMap.values()) {
      if (!value) {
        wordVisibilityChanged = true;
        break;
      }
    }
    this.wordVisibilityChanged = wordVisibilityChanged;
  }

  /**
   * Sets visibility to false for all entities that are not within the range specified by the user. This DOES NOT redraw the cloud! The
   * calling function should bre responsible for the redraw.
   */
  private filterByFrequency() {
    const minimumFrequency = this.form.get('minimumFrequency').value;
    const maximumFrequency = this.form.get('maximumFrequency').value;

    for (const annotation of this.annotationData) {
      this.wordVisibilityMap.set(annotation.text,  minimumFrequency <= annotation.frequency && annotation.frequency <= maximumFrequency);
    }
    this.invalidateWordVisibility();
  }

  /**
   * Helper function for applying all filter and grouping methods simultaneously. Used by the filter form submission function.
   */
  private applyFiltersAndGroupings() {
    this.filterByFrequency();
  }

  /**
   * Validation function used by the filter form group to check validity of the maximum and minimum frequency values.
   */
  private minMaxFreqValidator(): ValidatorFn {
    return (fg: FormGroup): ValidationErrors => {
      const minFreqControl = fg.get('minimumFrequency');
      const maxFreqControl = fg.get('maximumFrequency');

      if (minFreqControl.value > maxFreqControl.value) {
        minFreqControl.setErrors({ ...minFreqControl.errors, badMinMax: true });
        maxFreqControl.setErrors({ ...maxFreqControl.errors, badMinMax: true });
      } else {
        let minFreqControlErrors = minFreqControl.errors;
        let maxFreqControlErrors = maxFreqControl.errors;

        // Need to remove the 'badMinMax' property entirely from the errors object; as long as the property exists, the error is assumed to
        // exist
        if (!isNullOrUndefined(minFreqControlErrors)) {
          delete minFreqControlErrors.badMinMax;

          // If there are no more properties in the errors object, we need to set errors to null in order for it to be recognized as valid
          // (an empty object will still mark the control as invalid)
          if (Object.keys(minFreqControlErrors).length === 0) {
            minFreqControlErrors = null;
          }
        }

        // Do the same for the max frequency control
        if (!isNullOrUndefined(maxFreqControlErrors)) {
          delete maxFreqControlErrors.badMinMax;

          if (Object.keys(maxFreqControlErrors).length === 0) {
            maxFreqControlErrors = null;
          }
        }

        minFreqControl.setErrors(minFreqControlErrors);
        maxFreqControl.setErrors(maxFreqControlErrors);
      }

      return fg.errors;
    };
  }
}
