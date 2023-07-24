export class InfoPanel {
  public activeTab: string;

  public set tabs(value: Array<string>) {
    this.activeTab = value.includes(this.activeTab) ? this.activeTab : this.defaultTab;
  }

  constructor(private readonly defaultTab: string = 'properties') {
    this.activeTab = defaultTab;
  }
}
