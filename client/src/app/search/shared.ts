export interface SearchType {
  id: string;
  shorthand: string;
  name: string;
}

export interface SynonymData {
  type: string;
  fullName: string;
  organism: string;
  aliases: string[];
}
