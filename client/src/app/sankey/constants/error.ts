import { capitalize } from 'lodash';

// tslint:disable-next-line:variable-name
export const ErrorMessages = {
  missingNetworkTraces: 'File does not contain any network traces',
  missingNodes: 'File does not contain any nodes',
  missingLinks: 'File does not contain any links',
  missingLinkTrace: 'Link trace is missing',
  missingEntityType: (type: string) =>
    `Entity type ${type} is not supported`,
  missingEntity: (id: string|number) =>
    `No entity found for id ${id}`,
  missingNode: (id: string|number) =>
    `Node (id: ${id}) needed to render this graph has not been provided in file.`,
  missingValueAccessor: (type: string, id: string|number) =>
    `${capitalize(type)} values accessor ${id} could not be found`,
  missingNodeValueAccessor: (id: string|number) =>
    ErrorMessages.missingValueAccessor('node', id),
  missingLinkValueAccessor: (id: string|number) =>
    ErrorMessages.missingValueAccessor('link', id),
  incorrectValueAccessor: (type: string, predefinedProperties: Iterable<string>) =>
    `Predefined ${type} value accessor accesses not existing properties: ${Array.from(predefinedProperties)}`,
  incorrectLinkValueAccessor: (predefinedProperties: Iterable<string>) =>
    ErrorMessages.incorrectValueAccessor('link', predefinedProperties),
  incorrectNodeValueAccessor: (predefinedProperties: Iterable<string>) =>
    ErrorMessages.incorrectValueAccessor('node', predefinedProperties),
  exccedPaletteSize: (palette: string[], size) =>
    `Predefined palette has not enough colors. ` +
    `From palette [${Array.from(palette)}] (size: ${palette.length}), requested ${size} colors.`,
  noColorMapping: (label: string) =>
    `There is no color mapping for label: ${label}`,
  notImplemented: 'Not implemented'
};

