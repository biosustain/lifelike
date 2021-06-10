export interface SearchType {
  id: string;
  shorthand: string;
  name: string;
}

export interface SynonymData {
  type: string;
  description: string;
  organism: string;
  aliases: string[];
}
