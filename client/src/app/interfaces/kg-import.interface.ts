export enum GeneMatchingPropertyType {
    ID = 'ID',
    NAME = 'Name',
}

export enum RelationshipDirection {
    TO = 'To',
    FROM = 'From'
}

export interface Properties {
    column: number;
    propertyName: string;
}

export interface ImportRelationship {
    columnIndex1: number;
    columnIndex2: number;
    nodeLabel1: string;
    nodeLabel2: string;
    nodeProperties1: Properties[];
    nodeProperties2: Properties[];
    relationshipLabel: string;
    relationshipDirection: string;
    relationshipProperties: Properties[];
}

export interface GeneImportRelationship extends ImportRelationship {
    speciesSelection?: number[];
    geneMatchingProperty?: string[];
}
