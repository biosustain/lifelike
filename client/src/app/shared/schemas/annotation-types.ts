export interface DatabaseLink {
  name: string;
  url: string;
}

export class EntityType {
  id: string;

  constructor(
    public name: string,
    public color: string,
    public sources: string[],
    public links: DatabaseLink[]
  ) {
    this.id = name;
  }
}
