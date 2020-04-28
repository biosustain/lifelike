export interface PdfFiles {
  files: PdfFile[];
}

export enum AnnotationStatus {
  Success = '✓',
  Failure = '✗',
  Loading = '...',
}

export interface PdfFile {
  file_id: string;
  filename: string;
  creation_date: string;
  username: string;
  annotation_status?: AnnotationStatus;
}

export interface PdfFileUpload {
  file_id: string;
  filename: string;
  status: string;
}

export interface Reannotation {
  annotated: string[];
  not_annotated: string[];
  not_found: string[];
}
