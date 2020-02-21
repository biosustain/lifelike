import { FileNameAndSheets, NodeMappingHelper } from '../../interfaces/user-file-import.interface';

export interface State {
    fileNameAndSheets: FileNameAndSheets;
    dbLabels: string[];
    dbRelationshipTypes: string[];
    nodeProperties: { [key: string]: string[] };
    nodeMappingHelper: NodeMappingHelper;
}

export const initialState: State = {
    fileNameAndSheets: null,
    dbLabels: null,
    dbRelationshipTypes: null,
    nodeProperties: null,
    nodeMappingHelper: null,
};
