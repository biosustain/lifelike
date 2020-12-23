/* tslint:disable:member-ordering */
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { DropdownController, FitOptions } from '../../utils/dom/dropdown-controller';
import { MouseNavigableDirective } from '../../directives/mouse-navigable.directive';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-select-input',
  templateUrl: './select-input.component.html',
  styleUrls: [
    './select-input.component.scss',
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: SelectInputComponent,
    multi: true,
  }],
})
export class SelectInputComponent<T extends { label?: string }>
  implements OnChanges, AfterViewInit, AfterViewChecked, ControlValueAccessor {

  // TODO: Handle wrapping

  @Input() choices: T[] = [];
  @Input() choiceToKey: (choice: T) => any = (choice) => choice;
  @Input() noResultsText = 'No suggestions';
  @Input() multiple = false;
  @Input() placeholder = '';
  @Input() loading = false;
  @Output() choiceListRequest = new EventEmitter<ChoiceListRequest>();

  @ViewChild('inputContainer', {static: true}) inputContainerElement: ElementRef;
  @ViewChild('input', {static: true}) inputElement: ElementRef;
  @ViewChild('dropdown', {static: true}) dropdownElement: ElementRef;
  @ViewChild(MouseNavigableDirective, {
    static: true,
    read: MouseNavigableDirective,
  }) mouseNavigableDirective;
  @ContentChild('inputChoiceTemplate', {static: false}) inputChoiceTemplateRef: TemplateRef<any>;
  @ContentChild('dropdownChoiceTemplate', {static: false}) dropdownChoiceTemplateRef: TemplateRef<any>;
  @ContentChild('noResultsTemplate', {static: false}) noResultsTemplateRef: TemplateRef<any>;

  protected ready = false;
  selection: Map<any, T> = new Map<any, T>();
  unselectedChoices: T[] = [];
  request: ChoiceListRequest = {
    query: '',
  };
  protected dropdownController: DropdownController;
  protected changeCallback: ((value: any) => any) | undefined;
  protected touchCallback: (() => any) | undefined;

  constructor(protected readonly element: ElementRef,
              protected readonly renderer: Renderer2) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('choices' in changes) {
      this.updateUnselectedChoices(changes.choices.currentValue);
    }
  }

  ngAfterViewInit() {
    this.dropdownController = new DropdownController(
      this.renderer,
      this.element.nativeElement,
      this.dropdownElement.nativeElement, {
        viewportSpacing: 5,
        fixedAnchorPoint: true,
      },
    );
    this.ready = true;
  }

  ngAfterViewChecked() {
    if (this.dropdownController != null) {
      this.dropdownController.fit(this.fitOptions);
    }
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e) {
    if (this.ready) {
      this.closeDropdownIfNotFocused(e.target);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.ready) {
      this.closeDropdownIfNotFocused(e.target);
    }
  }

  @HostListener('document:focusin', ['$event'])
  onDocumentFocusIn(e: MouseEvent) {
    if (this.ready) {
      this.closeDropdownIfNotFocused(e.target);
    }
  }

  onInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const first = this.mouseNavigableDirective.getFirst();
      if (first != null) {
        first.focus();
        first.scrollIntoView();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const last = this.mouseNavigableDirective.getLast();
      if (last != null) {
        last.focus();
        last.scrollIntoView();
      }
    } else if (event.key === 'Escape') {
      this.focusOut();
    } else if (event.key === 'Enter') {
      event.preventDefault();
    } else if (event.key === 'Backspace') {
      const textSelection = window.getSelection();
      if (textSelection.rangeCount) {
        const range = textSelection.getRangeAt(0);
        if (range.commonAncestorContainer === this.inputElement.nativeElement
          && range.startOffset === 0 && range.endOffset === 0) {
          if (this.selection.size) {
            const selection = this.selectedChoices;
            this.deselect(selection[selection.length - 1]);
          }
        }
      }
    } else {
      this.openDropdown();
    }
  }

  onInputKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
    } else {
      this.updateQuery();
      this.openDropdown();
      this.focusInput();
    }
  }

  onInputPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  onInputFocus(event) {
    this.openDropdown();
  }

  onDropdownKeyUpPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.focusOut();
      this.focusInput();
    }
  }

  protected updateQuery() {
    this.request = {
      query: (event.target as HTMLInputElement).textContent,
    };
    this.choiceListRequest.emit(this.request);
  }

  protected updateUnselectedChoices(choices: T[]) {
    this.unselectedChoices = (choices as T[])
      .filter(choice => !this.isSelected(choice));
  }

  get fitOptions(): FitOptions {
    return {
      maxWidth: 250,
    };
  }

  protected openDropdown() {
    this.dropdownController.openRelative(this.inputElement.nativeElement, {
      placement: 'bottom-left',
      ...this.fitOptions,
    });
  }

  protected closeDropdown() {
    this.dropdownController.close();
  }

  protected focusOut() {
    this.closeDropdown();
  }

  private closeDropdownIfNotFocused(target: EventTarget | null) {
    if (target != null) {
      if (target !== this.inputElement.nativeElement &&
        !this.dropdownElement.nativeElement.contains(target)) {
        this.focusOut();
      }
    }
  }

  focusInput() {
    this.inputElement.nativeElement.focus();
  }

  get hasInput() {
    return this.selection.size || this.inputElement.nativeElement.innerText.length;
  }

  get selectedChoices() {
    return [...this.selection.values()];
  }

  clear() {
    this.selection.clear();
    this.handleSelectionChange();
  }

  select(choice: T) {
    if (!this.multiple) {
      this.clear();
    }
    this.selection.set(this.choiceToKey(choice), choice);
    this.handleSelectionChange();
  }

  deselect(choice: T) {
    this.selection.delete(this.choiceToKey(choice));
    this.handleSelectionChange();
  }

  toggle(choice: T) {
    if (this.isSelected(choice)) {
      this.deselect(choice);
    } else {
      this.select(choice);
    }
  }

  protected handleSelectionChange() {
    if (this.changeCallback) {
      this.changeCallback(this.selectedChoices);
    }
    if (this.touchCallback) {
      this.touchCallback();
    }
    this.inputElement.nativeElement.innerText = '';
    this.updateQuery();
    this.updateUnselectedChoices(this.choices);
    this.focusInput();
    if (!this.multiple) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  isSelected(choice: T) {
    return this.selection.has(this.choiceToKey(choice));
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(obj: any): void {
    this.selection.clear();
    if (obj != null) {
      for (const choice of obj) {
        this.selection.set(this.choiceToKey(choice), choice);
      }
    }
  }

  onItemKeyPress(event: KeyboardEvent, choice: T) {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      this.toggle(choice);
    }
  }
}

export interface ChoiceListRequest {
  query: string;
}
