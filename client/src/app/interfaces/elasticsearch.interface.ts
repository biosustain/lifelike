/* PDF search result backend representation  */
export interface PDFResult {
  results: {
    hits: [object];
    maxScore: number;
    total: number;
  };
}
