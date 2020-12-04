export interface MultipleItemDataResponse<T> {
  items: { [hashId: string]: T };
  missing: string[];
}
