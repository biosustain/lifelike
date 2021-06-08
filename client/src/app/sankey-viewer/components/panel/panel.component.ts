import { Component, OnDestroy, OnInit, Output, EventEmitter, Input, OnChanges, SimpleChanges, TemplateRef, } from '@angular/core';
import { FormControl, FormGroup, Validators, } from '@angular/forms';

import { uniqueId } from 'lodash';

import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { DefaultOrderByOptions, OrderDirection, } from 'app/interfaces/annotation-filter.interface';

@Component({
  selector: 'app-sankey-panel',
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.scss'],
})
export class SankeyPanelComponent implements OnInit, OnDestroy, OnChanges {
  id = uniqueId('PanelComponent-');

  outputSubject: Subject<any>;
  outputSubjectSub: Subscription;

  wordVisibilityMap: Map<string, boolean>;
  wordVisibilityChanged: boolean;

  typeVisibilityMap: Map<string, boolean>;
  disabledTypeMap: Map<string, boolean>;

  filtersForm: FormGroup;
  filtersFormValueChangesSub: Subscription;

  minimumValueInputId: string;
  maximumValueInputId: string;

  selectedOrderByOption: string;
  selectedOrderDirection: string;
  orderByOptions: string[];
  orderDirections: string[];

  legend: Map<string, string>;

  initialized = false;

  filters;
  sorting;
  grouping;

  @Output() filter: EventEmitter<number> = new EventEmitter();
  @Output() linkSize: EventEmitter<any> = new EventEmitter<any>();

  @Input() paths;
  @Input() nodeCategories;

  @Input() details: {
    template: TemplateRef<any>,
    data: any
  };

  filteredNodeCategories = new Set();

  isTypeVisible(cat) {
    return this.filteredNodeCategories.has(cat);
  }

  changeTypeVisibility(cat) {
    const {filteredNodeCategories} = this;
    if (filteredNodeCategories.has(cat)) {
      filteredNodeCategories.delete(cat);
    } else {
      filteredNodeCategories.add(cat);
    }
    this.outputSubject.next(node => {
      node.hidden = !filteredNodeCategories.has(node.schemaClass);
      return node;
    });
  }

  constructor() {
    this.outputSubject = new Subject<boolean>();

    this.wordVisibilityMap = new Map<string, boolean>();
    this.typeVisibilityMap = new Map<string, boolean>();
    this.disabledTypeMap = new Map<string, boolean>();

    this.selectedOrderByOption = DefaultOrderByOptions.FREQUENCY;
    this.selectedOrderDirection = OrderDirection.DESCENDING;

    this.minimumValueInputId = `${this.id}-mininum-frequency-input`;
    this.maximumValueInputId = `${this.id}-maximum-frequency-input`;

    this.legend = new Map<string, string>();
  }

  ngOnChanges({nodeCategories}: SimpleChanges) {
    if (nodeCategories && nodeCategories.firstChange) {
      this.filteredNodeCategories = new Set(nodeCategories.currentValue.keys());
    }
  }

  ngOnInit() {
    const validators = [
      Validators.required
    ];
    this.filtersForm = new FormGroup(
      // Form controls
      {
        nodeCategory: new FormControl(0, validators)
      }
    );
    this.filteredNodeCategories = new Set(this.nodeCategories.keys());

    // Basically debounces the word visibility output. Any time the parent component should know about visibility changes, we should emit a
    // new value to `outputSubject`, rather than emitting to `wordVisibilityOutput` directly.
    this.outputSubjectSub = this.outputSubject
      .asObservable()
      .pipe(debounceTime(250))
      .subscribe(filter => {
        this.filter.emit(filter);
      });

    // Anytime the frequency filters change, output to the parent so the word cloud is redrawn.
    this.filtersFormValueChangesSub = this.filtersForm.valueChanges.subscribe(
      () => {
        if (this.filtersForm.valid) {
          this.outputSubject.next();
        }
      }
    );

    // Apply filters to initial data and output to parent
    this.outputSubject.next();
    this.initialized = true;
  }

  ngOnDestroy() {
    // `complete` effectively unsubscribes from the `outputSubjectSub`, so we don't need to manually unsubscribe from it here.
    this.outputSubject.complete();
    this.filtersFormValueChangesSub.unsubscribe();
  }
}
