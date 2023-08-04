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

import { filter as _filter, flow as _flow, join as _join } from 'lodash/fp';

import { PromptComposer } from '../../../interface';

export interface EnrichmentPromptFormParams {
  formInput: {
    context: string;
    goTerm: string;
    geneName: string;
  };

  contexts: string[];
  goTerms: string[];
  geneNames: string[];
}

@Component({
  selector: 'app-enrichment-prompt-from',
  templateUrl: './enrichment-prompt-from.component.html',
})
export class EnrichmentPromptFormComponent implements OnChanges, PromptComposer, OnInit {
  PSEUDOCODE = `
if all inputs are provided:
  return a string that says: "For [organism], what function does [geneName] have in [term], in context of [context]?"
if organism, term, and geneName are provided:
  return a string that says: "For [organism], what function does [geneName] have in [term]?"
if organism, term, and context are provided:
  return a string that says: "For [organism], what is the relationship between [term] and [context]?"
if organism and term are provided:
  return a string that says: "What is the relationship between [organism] and [term]?"
otherwise:
  create a list of all the inputs that are not empty join the list with commas and separate by spaces
  return a string that says: "What is the relationship between [list_str]?"
  `
  readonly form = new FormGroup({
    organism: new FormControl(''),
    context: new FormControl(''),
    goTerm: new FormControl(''),
    geneName: new FormControl(''),
  });
  @Output() readonly prompt$ = new EventEmitter<string>();
  @Input() formInput: EnrichmentPromptFormParams['formInput'];
  @Input() contexts: EnrichmentPromptFormParams['contexts'] = [];
  @Input() goTerms: EnrichmentPromptFormParams['goTerms'] = [];
  @Input() geneNames: EnrichmentPromptFormParams['geneNames'] = [];

  ngOnChanges({ formInput }: SimpleChanges) {
    if (formInput) {
      this.form.patchValue(formInput.currentValue);
    }
  }

  parseEntitiesToPropmpt(organism, term, context, geneName): string {
    if (organism && term && context && geneName) {
      return `For ${organism}, what function does ${geneName} have in ${term}, in context of ${context}?`;
    }
    if (organism && term && geneName) {
      return `For ${organism}, what function does ${geneName} have in ${term}?`;
    }
    if (organism && term && context) {
      return `For ${organism}, what is the relationship between ${term} and ${context}?`;
    }
    if (organism && term) {
      return `What is the ralationship between ${organism} and ${term}?`;
    }
    const listStr = _flow(_filter(Boolean), _join(', '))([organism, term, context, geneName]);
    return `What is the ralationship between ${listStr}?`;
  }

  private organismPicked(organism: string) {
    const organismControl = this.form.get('organism');
    organismControl.setValue(organism);
    organismControl.markAsDirty();
  }

  emitPrompt() {
    this.prompt$.emit(
      this.parseEntitiesToPropmpt(
        this.form.value.organism,
        this.form.value.goTerm,
        this.form.value.context,
        this.form.value.geneName
      )
    );
  }

  onSubmit() {
    this.emitPrompt();
  }

  ngOnInit() {
    this.emitPrompt();
  }
}
