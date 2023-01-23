import { defaultsDeep, assign } from 'lodash-es';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';

import { NODE_DEFAULTS, GROUP_DEFAULTS, IMAGE_DEFAULTS } from '../defaults';

/**
 * Create new node object (with new hash and default values)
 * @param partialNode - object to be transformed into node (it will mutate)
 */
export const createNode = partialNode => assign(defaultsDeep(partialNode, NODE_DEFAULTS), { hash: uuidv4() });

/**
 * Create new group node object (with new hash and default values)
 * @param partialGroup - object to be transformed into group node (it will mutate)
 */
export const createGroupNode = partialGroup =>
  createNode(
    defaultsDeep(partialGroup, GROUP_DEFAULTS)
  );

/**
 * Create new image node object (with new hash and default values)
 * @param partialImage - object to be transformed into image node (it will mutate)
 */
export const createImageNode = partialImage =>
  assign(
    createNode(
      defaultsDeep(partialImage, IMAGE_DEFAULTS)
    ),
    { imageId: makeid() }
  );
