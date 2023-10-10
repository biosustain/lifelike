import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';

import { PromptComposer } from '../../../interface';

export interface DrawingToolPromptFormParams {
  formInput: {
    context: string;
    entities: string[];
  };

  contexts: string[];
}

@Component({
  selector: 'app-drawing-tool-prompt-form',
  templateUrl: './drawing-tool-prompt-from.component.html',
})
export class DrawingToolPromptFormComponent implements OnChanges, PromptComposer, OnInit {
  PSEUDOCODE = `
if all inputs are provided or there is more than one entity:
  What is the relationship between [entities], [context]?
otherwise:
  What is [entity or context]?
  `;
  readonly form = new FormGroup({
    context: new FormControl(''),
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
  });
  @Output() readonly prompt$ = new EventEmitter<string>();
  @Input() formInput: DrawingToolPromptFormParams['formInput'];
  @Input() contexts: DrawingToolPromptFormParams['contexts'] = [];

  ngOnChanges({ formInput }: SimpleChanges) {
    if (formInput) {
      this.form.patchValue(formInput.currentValue);
    }
  }

  parseEntitiesToPropmpt(entities: string[], context: string) {
    return (
      'What is the relationship between ' +
      entities.join(', ') +
      (context ? `, ${context}` : '') +
      '?'
      // + '\nPlease provide URL sources for your answer.'
    );
  }

  emitPrompt() {
    this.prompt$.emit(
      this.parseEntitiesToPropmpt(this.form.value.entities, this.form.value.context)
    );
  }

  onSubmit() {
    this.emitPrompt();
  }

  ngOnInit() {
    this.emitPrompt();
  }
}
