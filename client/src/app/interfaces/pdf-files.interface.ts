export interface PdfFiles {
  files: PdfFile[];
}

export enum AnnotationStatus {
  Success = '✓',
  Failure = '✗',
  Loading = '...',
}

export interface PdfFile {
  // minimum field needed for the interface
  file_id: string;
  // optional
  filename?: string;
  creation_date?: string;
  username?: string;
  annotation_status?: AnnotationStatus;
}

export interface PdfFileUpload {
  file_id: string;
  filename: string;
  status: string;
}
