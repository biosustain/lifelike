import { FileNameAndSheets } from 'app/interfaces/neo4j.interface';

export interface State {
    fileNameAndSheets: FileNameAndSheets;
    dbLabels: string[];
    nodeProperties: { [key: string]: string[] };
}

export const initialState: State = {
    fileNameAndSheets: null,
    dbLabels: null,
    nodeProperties: null,
};
