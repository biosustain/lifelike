import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';
import { Annotation } from '../html-view.component';

@Component({
  selector: 'app-html-annotated-text',
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
    this.txt.parentNode.removeChild(this.txt);
  }

  ngOnChanges(changes: SimpleChanges) {
    // todo: nested annotations are allowed but not implemented
    const globalOffset = this.offset || 0;
    const decodedText = this.decodeHTML(this.text);
    this.parts = this.annotations.reduce((acc, annotation) => {
      return annotation.locations.reduce((iacc, location) => {
        let part, offset = 0, idx;
        for (idx = 0; idx < iacc.length; idx++) {
          part = iacc[idx];
          const localOffset = part.location ? part.location.length : part.length;
          if (offset + localOffset >= location.offset) {
            if (offset > location.offset || part.location) {
              console.warn('Error state');
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
        const start_offset = -offset + location.offset;
        const end_offset = -offset + location.offset + location.length;
        if (part.slice(start_offset, end_offset) != annotation.text) {
          console.warn(
            `${part.slice(start_offset, end_offset)} != ${annotation.text}`,
            part,
            annotation,
            location
          );
          for (let i = 0; i < part.length; i++) {
            if (part.slice(start_offset - i, end_offset - i) == annotation.text) {
              console.warn(
                `Correct for ${-i}`,
                part.idx,
                globalOffset,
                part,
                annotation
              );
              break;
            }
            if (part.slice(start_offset + i, end_offset + i) == annotation.text) {
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
        }
        return iacc
          .slice(0, idx)
          .concat([
            part.slice(0, start_offset),
            {...annotation, location},
            part.slice(end_offset)
          ])
          .concat(iacc.slice(idx + 1));
      }, acc);
    }, [decodedText]);
  }
}
