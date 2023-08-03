import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';

import { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

import { FormArrayWithFactory } from 'app/shared/utils/forms/with-factory';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';

import { PromptComposer } from '../../../interface';

export interface EnrichmentPromptFormParams {
  context: string;
  goTerm: string;
  geneName: string;

  contexts: string[];
  goTerms: string[];
  geneNames: string[];
}

@Component({
  selector: 'app-drawing-tool-prompt-form',
  templateUrl: './enrichment-prompt-from.component.html',
})
export class EnrichmentPromptFormComponent implements OnChanges, PromptComposer {
  readonly form = new FormGroup({
    context: new FormControl(''),
    goTerm: new FormControl(''),
    geneName: new FormControl(''),
  });
  @Output() readonly prompt$ = new EventEmitter<string>();
  @Input() params: EnrichmentPromptFormParams;

  contexts: string[] = [];
  goTerms: string[] = [];
  geneNames: string[] = [];

  ngOnChanges({ params }: SimpleChanges) {
    if (params) {
      const { context, goTerm, geneName } = params.currentValue;
      this.form.patchValue({ context, goTerm, geneName });
      const { contexts, goTerms, geneNames } = params.currentValue;
      this.contexts = contexts;
      this.goTerms = goTerms;
      this.geneNames = geneNames;
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
