import { defaultsDeep, assign, chain } from 'lodash-es';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import { UniversalGraphGroup, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { NODE_DEFAULTS, GROUP_DEFAULTS, IMAGE_DEFAULTS } from '../defaults';

/**
 * Create new node object (with new hash and default values)
 * @param partialNode - object to be transformed into node (it will mutate)
 */
export const createNode: (partialNode: Partial<UniversalGraphNode>) => UniversalGraphNode =
  partialNode => chain(partialNode)
    .cloneDeep() // Prevent object pass by ref from partial value
    .defaultsDeep(NODE_DEFAULTS)
    .assign({hash: uuidv4()})
    .value();

/**
 * Create new group node object (with new hash and default values)
 * @param partialGroup - object to be transformed into group node (it will mutate)
 */
export const createGroupNode: (partialGroup: Partial<UniversalGraphGroup>) => UniversalGraphGroup =
  partialGroup => chain(partialGroup)
    .cloneDeep() // Prevent object pass by ref from partial value
    .defaultsDeep(GROUP_DEFAULTS)
    .value();

/**
 * Create new image node object (with new hash and default values)
 * @param partialImage - object to be transformed into image node (it will mutate)
 */
export const createImageNode: (partialNode: Partial<UniversalGraphNode>) => UniversalGraphNode =
  partialImage => chain(partialImage)
    .cloneDeep() // Prevent object pass by ref from partial value
    .defaultsDeep(IMAGE_DEFAULTS)
    .thru(createNode)
    .assign({imageId: makeid})
    .value();
