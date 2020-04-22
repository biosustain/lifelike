export interface PdfFiles {
  files: PdfFile[];
}

export interface PdfFile {
  file_id: string;
  filename: string;
  creation_date: string;
  username: string;
}

export interface PdfFileUpload {
  file_id: string;
  filename: string;
  status: string;
}
