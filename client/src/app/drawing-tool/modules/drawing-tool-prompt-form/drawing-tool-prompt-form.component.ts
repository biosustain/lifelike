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
import { PromptComposer } from 'app/playground/interfaces/prompt';

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
if there is only one entity and no context:
  What is [entity]?
else if there is only one entity and a context:
  What is [entity] in the context of [context]?
if there is more than one entity and no context:
  What is the relationship between [entities]?
if there is more than one entity and context:
  What is the relationship between [entities] in the context of [context]?
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
    const entitiesLength = entities.length;
    let queryCore: string;
    if (entitiesLength === 1) {
      queryCore = 'What is ' + entities[0];
    } else {
      queryCore = `What is the relationship between ${entities.join(', ')}`;
    }
    const contextQuery =  (context ? ` in the context of ${context}` : '');

    return queryCore + contextQuery + '?';
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
