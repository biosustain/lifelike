import { FileNameAndSheets } from '../../interfaces/neo4j.interface';

export interface State {
    fileNameAndSheets: FileNameAndSheets;
}

export const initialState: State = {
    fileNameAndSheets: null,
};
