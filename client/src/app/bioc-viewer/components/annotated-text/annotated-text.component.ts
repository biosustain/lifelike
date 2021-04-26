import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';

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

  parts: string[];

  private txt;

  constructor() {
    this.txt = document.createElement('textarea');
  }

  decodeHTML(html) {
    this.txt.innerHTML = html;
    return this.txt.value;
  }

  ngOnDestroy() {
    this.txt.parentNode.removeChild(this.txt);
  }

  ngOnChanges(changes: SimpleChanges) {
    const globalOffset = this.offset;
    const decodedText = this.decodeHTML(this.text);
    this.parts = this.annotations.reduce((acc, annotation) => {
      return annotation.locations.reduce((iacc, location) => {
        const part = iacc.reduce((o, part, idx) => {
          if (part.location) {
            o.offset = part.location.offset + part.location.length;
          } else if (o.offset < location.offset) {
            o.text = part;
            o.idx = idx;
          }
          return o;
        }, {offset: 0, text: '', idx: 0});
        part.offset += globalOffset;
        const start_offset = -part.offset + location.offset;
        const end_offset = -part.offset + location.offset + location.length;
        if (part.text.slice(start_offset, end_offset) != annotation.text) {
          console.warn(
            `${part.text.slice(start_offset, end_offset)} != ${annotation.text}`,
            part,
            annotation
          );
        }
        return iacc
          .slice(0, part.idx)
          .concat([
            part.text.slice(0, start_offset),
            {...annotation, location},
            part.text.slice(end_offset)
          ])
          .concat(iacc.slice(part.idx + 1));
      }, acc);
    }, [decodedText]);
    console.log(this.text, this.parts);
  }
}
