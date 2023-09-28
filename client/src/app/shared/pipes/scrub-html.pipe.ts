import { NgModule, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

// TODO: not used?
@Pipe({
  name: 'scrubHtml',
})
export class ScrubHtmlPipe implements PipeTransform {
  constructor(private domSanitizer: DomSanitizer) {}

  transform(value: string): any {
    return this.domSanitizer.sanitize(SecurityContext.HTML, value);
  }
}

@NgModule({
  declarations: [ScrubHtmlPipe],
})
class NotUsedModule {
  /**
   * This module is not used anywhere.
   * It is declared to make the compiler happy.
   */
  constructor() {
    throw new Error('Not reachable');
  }
}
