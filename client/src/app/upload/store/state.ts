import { FileNameAndSheets, NodeMappingHelper } from '../../interfaces/importer.interface';

export interface State {
    fileNameAndSheets: FileNameAndSheets;
    dbLabels: string[];
    nodeProperties: { [key: string]: string[] };
    nodeMappingHelper: NodeMappingHelper;
}

export const initialState: State = {
    fileNameAndSheets: null,
    dbLabels: null,
    nodeProperties: null,
    nodeMappingHelper: null,
};
