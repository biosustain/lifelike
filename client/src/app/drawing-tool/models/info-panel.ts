import { first as _first } from 'lodash/fp';

export class InfoPanel {
  public activeTab: string;

  public set tabs(value: Array<string>) {
    this.activeTab = value.includes(this.activeTab)
      ? this.activeTab
      : value.includes(this.defaultTab)
      ? this.defaultTab
      : _first(value);
  }

  constructor(private readonly defaultTab: string = 'properties') {
    this.activeTab = defaultTab;
  }
}
