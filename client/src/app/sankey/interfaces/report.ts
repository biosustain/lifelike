// region Path report
export interface SankeyPathReportEntity {
  label: string;
  row: number;
  column: number;
  type: 'node' | 'link' | 'spacer';
}

export interface SankeyPathReport {
  [networkTrace: string]: SankeyPathReportEntity[][];
}
