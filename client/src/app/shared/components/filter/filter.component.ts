import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { uniqueId } from 'lodash';

import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import {
  FilterEntity,
  DefaultGroupByOptions,
  DefaultOrderByOptions,
  OrderDirection,
  Visibility,
} from 'app/interfaces/filter.interface';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrls: ['./filter.component.scss'],
})
export class FilterComponent implements OnInit, OnDestroy {
  id = uniqueId('FilterComponent-');

  @Input() data: FilterEntity[];
  @Output() wordVisibilityOutput: EventEmitter<Map<string, boolean>>;

  outputSubject: Subject<boolean>;
  outputSubjectSub: Subscription;

  wordVisibilityMap: Map<string, boolean>;
  wordVisibilityChanged: boolean;
  visibility: Visibility[];

  typeVisibilityMap: Map<string, boolean>;
  disabledTypeMap: Map<string, boolean>;

  filtersForm: FormGroup;
  filtersFormValueChangesSub: Subscription;

  minimumFrequencyInputId: string;
  maximumFrequencyInputId: string;

  selectedGroupByOption: string;
  selectedOrderByOption: string;
  selectedOrderDirection: string;
  groupByOptions: string[];
  orderByOptions: string[];
  orderDirections: string[];

  legend: Map<string, string>;

  constructor() {
    this.outputSubject = new Subject<boolean>();

    this.wordVisibilityMap = new Map<string, boolean>();
    this.typeVisibilityMap = new Map<string, boolean>();
    this.disabledTypeMap = new Map<string, boolean>();

    this.filtersForm = new FormGroup(
      // Form controls
      {
        minimumFrequency: new FormControl(0, [
          Validators.required,
          Validators.min(0),
          Validators.pattern(/^-?[0-9][^\.]*$/),
        ]),
        // TODO: Removing for now, may bring back
        // maximumFrequency: new FormControl(
        //   0, [Validators.required, Validators.min(0), Validators.pattern(/^-?[0-9][^\.]*$/)]
        // ),
      }
      // Form group validators
      // TODO: Don't need this right now, bring it back later if we bring back max frequency
      // [this.minMaxFreqValidator()]
    );

    this.selectedOrderByOption = DefaultOrderByOptions.FREQUENCY;
    this.selectedOrderDirection = OrderDirection.DESCENDING;

    this.minimumFrequencyInputId = `${this.id}-mininum-frequency-input`;
    this.maximumFrequencyInputId = `${this.id}-maximum-frequency-input`;

    this.wordVisibilityOutput = new EventEmitter<Map<string, boolean>>();

    this.setGroupByOptions();
    this.setOrderByOptions();
    this.setOrderDirections();

    this.legend = new Map<string, string>();
  }

  ngOnInit() {
    // The very first time we get the Data, set the default values for the frequency filters
    this.filtersForm.get('minimumFrequency').setValue(1);
    // TODO: Uncomment if we bring back max frequency
    // this.filtersForm.get('maximumFrequency').setValue(this.Data[0].frequency);

    // Get all the  types to populate the legend
    this.data.forEach(d => {
      this.legend.set(d.type, d.color);
    });

    // Set each type's visibility to true at first, we'll figure out what the visibility actually is in `applyFilters` below.
    this.legend.forEach((_, key) => {
      this.typeVisibilityMap.set(key, true);
    });

    this.applyFilters();

    // Basically debounces the word visibility output. Any time the parent component should know about visibility changes, we should emit a
    // new value to `outputSubject`, rather than emitting to `wordVisibilityOutput` directly.
    this.outputSubjectSub = this.outputSubject
      .asObservable()
      .pipe(debounceTime(250))
      .subscribe(() => {
        this.wordVisibilityOutput.emit(this.wordVisibilityMap);
      });

    // Anytime the frequency filters change, output to the parent so the word cloud is redrawn.
    this.filtersFormValueChangesSub = this.filtersForm.valueChanges.subscribe(
      () => {
        if (this.filtersForm.valid) {
          this.applyFilters();
          this.outputSubject.next();
        }
      }
    );
  }

  updateVisibility() {
    this.visibility = this.data.map((entity) => {
      const identifier = this.getIdentifier(entity);
      return {
        identifier,
        visible: this.isWordVisible(identifier),
        entity,
      };
    });
  }

  ngOnDestroy() {
    // `complete` effectively unsubscribes from the `outputSubjectSub`, so we don't need to manually unsubscribe from it here.
    this.outputSubject.complete();
    this.filtersFormValueChangesSub.unsubscribe();
  }

  getIdentifier(d: FilterEntity) {
    return d.id + d.type + d.text;
  }

  isWordVisible(identifier: string) {
    const value = this.wordVisibilityMap.get(identifier);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  isTypeVisible(type: string) {
    const value = this.typeVisibilityMap.get(type);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  /**
   * Changes the filter state of the given  to the given input state.
   * @param identifier string representing the  to change the state of
   * @param event checkbox event object containing the new state
   */
  changeWordVisibility(identifier: string, event) {
    this.wordVisibilityMap.set(identifier, event.target.checked);
    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();
    this.updateVisibility();
    this.outputSubject.next();
  }

  changeTypeVisibility(type: string, event) {
    this.typeVisibilityMap.set(type, event.target.checked);

    this.data.forEach(d => {
      if (d.type === type) {
        this.wordVisibilityMap.set(
          this.getIdentifier(d),
          this.typeVisibilityMap.get(d.type)
        );
      }

      // If we set the visibility of s with this type to 'true', then do a second filter on frequency so we don't show anything
      // not in the range.
      if (this.typeVisibilityMap.get(d.type)) {
        this.wordVisibilityMap.set(
          this.getIdentifier(d),
          this.filterByFrequency(d)
        );
      }
    });

    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();

    this.groupAndSortData();
    this.outputSubject.next();
  }

  /**
   * Sets all words in the word visibility map to the input state.
   * @param state boolean true/false representing a filter state for the word cloud
   */
  setAllWordsVisibility(state: boolean) {
    for (const d of this.data) {
      this.wordVisibilityMap.set(
        this.getIdentifier(d),
        state
      );
      this.typeVisibilityMap.set(d.type, state);

      // If we set the global state to 'true', then we should apply the current range filter
      if (state) {
        this.wordVisibilityMap.set(
          this.getIdentifier(d),
          this.filterByFrequency(d)
        );
      }
    }
    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();
    this.updateVisibility();
    this.outputSubject.next();
  }

  setGroupByOptions() {
    this.groupByOptions = [];
    this.selectedGroupByOption = DefaultGroupByOptions.NONE;
    for (const option in DefaultGroupByOptions) {
      if (typeof option === 'string') {
        this.groupByOptions.push(DefaultGroupByOptions[option]);
      }
    }
  }

  // TODO: This is effectively unused, may bring it back once we have more order by options
  setOrderByOptions() {
    this.orderByOptions = [];
    this.selectedOrderByOption = DefaultOrderByOptions.FREQUENCY;
    for (const option in DefaultOrderByOptions) {
      if (typeof option === 'string') {
        this.orderByOptions.push(DefaultOrderByOptions[option]);
      }
    }
  }

  // TODO: Effectively unused, may bring it back if we decide ordering direction is important
  setOrderDirections() {
    this.orderDirections = [];
    this.selectedOrderDirection = OrderDirection.DESCENDING;
    for (const option in OrderDirection) {
      if (typeof option === 'string') {
        this.orderDirections.push(OrderDirection[option]);
      }
    }
  }

  sortData() {
    switch (this.selectedOrderByOption) {
      case DefaultOrderByOptions.FREQUENCY:
        this.data.sort((a, b) =>
          this.sortByFrequency(a, b, this.selectedOrderDirection)
        );
        break;
    }
  }

  groupData() {
    switch (this.selectedGroupByOption) {
      case DefaultGroupByOptions.ENTITY_TYPE:
        this.groupDataByEntityType();
        break;
      // TODO: Bring this back if we decide to group on filtered in the future
      // case DefaultGroupByOptions.FILTERED:
      //   this.groupDataByFilteredState();
      //   break;
      case DefaultGroupByOptions.NONE:
      default:
        break;
    }
  }

  groupAndSortData() {
    this.sortData();
    this.groupData();
    this.updateVisibility();
  }

  private sortByFrequency(
    a: FilterEntity,
    b: FilterEntity,
    direction: string
  ) {
    return direction === OrderDirection.DESCENDING
      ? b.frequency - a.frequency
      : a.frequency - b.frequency;
  }

  private groupDataByEntityType() {
    const typeMap = new Map<string, FilterEntity[]>();

    this.legend.forEach((_, type) => typeMap.set(type, []));
    this.data.forEach(d =>
      typeMap.get(d.type).push()
    );
    this.data = Array.from(typeMap.values()).reduce(
      (accumulator, value) => accumulator.concat(value),
      []
    );
  }

  // TODO: Effectively unused, but keeping because we might add it back in the future
  private groupDataByFilteredState() {
    const filteredList = [];
    const unfilteredList = [];

    this.data.forEach(d => {
      if (
        this.wordVisibilityMap.get(this.getIdentifier(d))
      ) {
        unfilteredList.push();
      } else {
        filteredList.push();
      }
    });
    this.data = unfilteredList.concat(filteredList);
  }

  // TODO: Should consider wrapping the invalidation of word/type visibility into a single function, right now we do a lot of unnecessary
  // looping...Not a huge problem because the lists are generally going to be relatively small, but it may be a problem in the future.

  /**
   * Determines whether any words in the word cloud have been filtered. We use this to determine which (if any) of the buttons on the
   * widget to disable/enable. If any word not below the current frequency filter has been manually filtered, we show 'Show All'. If all
   * words not below the filter are shown, then we show 'Hide All'.
   */
  private invalidateWordVisibility() {
    // Keep track if the user has some entity types disabled
    let wordVisibilityChanged = false;

    this.data.forEach(d => {
      if (
        !this.wordVisibilityMap.get(this.getIdentifier(d)) &&
        this.filterByFrequency(d)
      ) {
        wordVisibilityChanged = true;
      }
    });
    this.wordVisibilityChanged = wordVisibilityChanged;
  }

  /**
   * Checks the visibility status of each  type and sets them accordingly. For example, if all 'Chemical' are filtered, then the
   * 'Chemical' option in the legend will be unchecked. If any 'Chemical' are not filtered, it is checked.
   */
  private invalidateTypeVisibility() {
    this.typeVisibilityMap.forEach((_, key) => {
      this.typeVisibilityMap.set(key, false);
      this.disabledTypeMap.set(key, true);
    });

    this.data.forEach(d => {
      if (
        this.wordVisibilityMap.get(this.getIdentifier(d))
      ) {
        this.typeVisibilityMap.set(d.type, true);
      }

      if (this.filterByFrequency(d)) {
        this.disabledTypeMap.set(d.type, false);
      }
    });
  }

  /**
   * Sets visibility to false for all entities that are not within the range specified by the user. This DOES NOT redraw the cloud! The
   * calling function should bre responsible for the redraw.
   */
  private filterByFrequency(d: FilterEntity) {
    const minimumFrequency = this.filtersForm.get('minimumFrequency').value;

    // TODO: Uncomment these if we bring back max frequency
    // const maximumFrequency = this.filtersForm.get('maximumFrequency').value;

    // return minimumFrequency <= .frequency && .frequency <= maximumFrequency;

    return minimumFrequency <= d.frequency;
  }

  /**
   * Helper function for applying all filter and grouping methods simultaneously. Used by the filter form submission/on-changes function.
   */
  private applyFilters() {
    for (const d of this.data) {
      const state = this.filterByFrequency(d);
      this.wordVisibilityMap.set(
        this.getIdentifier(d),
        state && this.typeVisibilityMap.get(d.type)
      );
    }
    this.invalidateTypeVisibility();
    this.invalidateWordVisibility();
    this.groupAndSortData();
  }

  // TODO: Currently unused, may bring it back in the future
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
