import { capitalize } from 'lodash';

// tslint:disable-next-line:variable-name
export const ErrorMessages = {
  missingNetworkTraces: 'File does not contain any network traces',
  missingNodes: 'File does not contain any nodes',
  missingLinks: 'File does not contain any links',
  missingEntityType: type => `Entity type ${type} is not supported`,
  missingEntity: id =>
    `No entity found for id ${id}`,
  missingNode: id =>
    `Node (id: ${id}) needed to render this graph has not been provided in file.`,
  missingValueAccessor: (type, id) =>
    `${capitalize(type)} values accessor ${id} could not be found`,
  missingNodeValueAccessor: id => ErrorMessages.missingValueAccessor('node', id),
  missingLinkValueAccessor: id => ErrorMessages.missingValueAccessor('link', id),
  incorrectValueAccessor: (type, predefinedProperties) =>
    `Predefined ${type} value accessor accesses not existing properties: ${Array.from(predefinedProperties)}`,
  incorrectLinkValueAccessor: predefinedProperties => ErrorMessages.incorrectValueAccessor('link', predefinedProperties),
  incorrectNodeValueAccessor: predefinedProperties => ErrorMessages.incorrectValueAccessor('node', predefinedProperties),
  exccedPaletteSize: (palette, size) =>
    `Predefined palette has not enough colors. ` +
    `From palette [${Array.from(palette)}] (size: ${palette.location}), requested ${size} colors.`,
  noColorMapping: label =>
    `There is no color mapping for label: ${label}`,
  wrongInOutDefinition: ids =>
    `Nodes set to be both graph sources and targets [${Array.from(ids)}]`,
  notImplemented: 'Not implemented'
};
