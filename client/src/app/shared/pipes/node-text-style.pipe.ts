import { NgModule, Pipe, PipeTransform } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

// TODO: not used?
@Pipe({
  name: 'nodeTextStyle',
})
export class NodeTextStylePipe implements PipeTransform {
  transform(value: string, ...args: any[]): any {
    const isUppercase = value === value.toUpperCase();

    if (isUppercase) {
      return value;
    } else {
      const titleCasePipe = new TitleCasePipe();
      return titleCasePipe.transform(value);
    }
  }
}

@NgModule({
  declarations: [NodeTextStylePipe],
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
