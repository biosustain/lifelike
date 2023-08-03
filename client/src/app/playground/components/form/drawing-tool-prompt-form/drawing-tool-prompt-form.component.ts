import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';

import { PromptComposer } from '../../../interface';

@Component({
  selector: 'app-drawing-tool-prompt-form',
  templateUrl: './drawing-tool-prompt-from.component.html',
})
export class DrawingToolPromptFormComponent implements OnChanges, PromptComposer {
  constructor(private readonly openFileProvider: OpenFileProvider) {}

  form = new FormGroup({
    entities: new FormArrayWithFactory(() => new FormControl(''), []),
    context: new FormControl(''),
  });
  @Output() prompt$ = new EventEmitter<string>();
  @Input() params: Record<string, any>;

  readonly contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({ contexts }) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnChanges({ params }: SimpleChanges) {
    if (params) {
      this.form.patchValue(params.currentValue);
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

  onSubmit() {
    this.prompt$.emit(
      this.parseEntitiesToPropmpt(this.form.value.entities, this.form.value.context)
    );
  }
}
