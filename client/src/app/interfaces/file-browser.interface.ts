export interface PdfFiles {
  files: PdfFile[];
}

export interface PdfFile {
  id: string;
  filename: string;
  creationDate: string;
  username: string;
  annotation?: string;
}
