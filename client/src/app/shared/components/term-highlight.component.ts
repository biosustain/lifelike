import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { annotationTypesMap } from '../annotation-styles';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { escape, escapeRegExp } from 'lodash';

@Component({
  selector: 'app-term-highlight',
  templateUrl: 'term-highlight.component.html',
})
export class TermHighlightComponent implements OnChanges {
  @Input() text = '';
  @Input() highlightTerms: string[] = [];
  highlight: string;

  ngOnChanges(changes: SimpleChanges) {
    if ('highlightTerms' in changes || 'text' in changes) {
      if (this.text && this.highlightTerms) {
        const phrasePatterns = this.highlightTerms.map(
          phrase => escapeRegExp(phrase).replace(/ +/g, ' +'),
        ).join('|');
        const pattern = `\\b(${phrasePatterns})\\b`;
        console.log(pattern);
        const regex = new RegExp(pattern, 'gi');
        this.highlight = '<snippet>' + escape(this.text)
          .replace(regex, '<highlight>$1</highlight>') + '</snippet>';
      } else {
        this.highlight = null;
      }
    }
  }
}
