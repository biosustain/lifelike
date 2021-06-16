import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
import { Annotation } from '../bioc-view.component';

@Component({
  selector: 'app-bioc-annotated-text',
  templateUrl: './annotated-text.component.html',
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./annotated-text.component.scss'],
})
export class AnnotatedTextComponent implements OnChanges, OnDestroy {
  @Input() text;
  @Input() annotations;
  @Input() offset;

  parts: (string | Annotation)[];

  private txt;

  constructor() {
    this.txt = document.createElement('textarea');
  }

  decodeHTML(html) {
    // this.txt.innerHTML = html;
    // return this.txt.value;
    // return html.replace(/&[A-z0-9]{2,5};/g, ' ');
    return html;
  }

  ngOnDestroy() {
    const parent = this.txt.parentNode;
    if (parent) {
      parent.removeChild(this.txt);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // todo: nested annotations are allowed but not implemented
    const globalOffset = this.offset || 0;
    const decodedText = this.decodeHTML(this.text);
    this.parts = this.annotations.reduce((acc, annotation) => {
      return annotation.locations.reduce((iacc, location) => {
        let part = 0;
        let offset = 0;
        let idx = 0;
        for (idx = 0; idx < iacc.length; idx++) {
          part = iacc[idx];
          const localOffset = part.location ? part.location.length : part.length;
          if (offset + localOffset + globalOffset >= location.offset) {
            if (offset + globalOffset > location.offset || part.location) {
              console.warn('Error state');
              return iacc;
            }
            break;
          }
          if (part.location) {
            // if possible use absolute offset to not propagate potential error
            offset = part.location.offset + part.location.length - globalOffset;
          } else {
            offset += localOffset;
          }
        }
        offset += globalOffset;
        const startOffset = -offset + location.offset;
        const endOffset = -offset + location.offset + location.length;
        const rawText = part.slice(startOffset, endOffset);
        if (rawText.length < location.length) {
          console.error('Ran out of index!', part, location, offset);
          return iacc;
        }
        if (part.slice(startOffset, endOffset) !== annotation.text) {
          console.warn(
            `${part.slice(startOffset, endOffset)} != ${annotation.text}`,
            part,
            annotation,
            location
          );
          for (let i = 0; i < part.length; i++) {
            if (part.slice(startOffset - i, endOffset - i) === annotation.text) {
              console.warn(
                `Correct for ${-i}`,
                part.idx,
                globalOffset,
                part,
                annotation
              );
              break;
            }
            if (part.slice(startOffset + i, endOffset + i) === annotation.text) {
              console.warn(
                `Correct for ${-i}`,
                part.idx,
                globalOffset,
                part,
                annotation
              );
              break;
            }
          }
          return iacc;
        }
        return iacc
          .slice(0, idx)
          .concat([
            part.slice(0, startOffset),
            {...annotation, location},
            part.slice(endOffset)
          ])
          .concat(iacc.slice(idx + 1));
      }, acc);
    }, [decodedText]);
  }
}
