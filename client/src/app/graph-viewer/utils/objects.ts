import { defaultsDeep, assign, merge, cloneDeep } from 'lodash-es';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import {
  UniversalGraphGroupTemplate,
  UniversalGraphNodeTemplate,
  UniversalGraphGroup, UniversalGraphImageNodeTemplate, UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';

import { GROUP_DEFAULTS_FACTORY, IMAGE_DEFAULTS_FACTORY, NODE_DEFAULTS_FACTORY } from '../defaults';

/**
 * Create new node object (with new hash and default values)
 * @param partialNode - object to be transformed into node (it will mutate)
 */
export const createNode =
  <N extends Partial<UniversalGraphNodeTemplate>>(partialNode: N) =>
    merge(
      NODE_DEFAULTS_FACTORY(),
      cloneDeep(partialNode),
      {hash: uuidv4()},
    ) as ReturnType<typeof NODE_DEFAULTS_FACTORY> & N & Pick<UniversalGraphNode, 'hash'>;

/**
 * Create new group node object (with new hash and default values)
 * @param partialGroup - object to be transformed into group node (it will mutate)
 */
export const createGroupNode =
  <G extends Partial<UniversalGraphGroupTemplate>>(partialGroup: G) =>
    createNode(
      merge(
        GROUP_DEFAULTS_FACTORY(),
        partialGroup,
      ),
    ) as ReturnType<typeof NODE_DEFAULTS_FACTORY> & ReturnType<typeof GROUP_DEFAULTS_FACTORY> & G & Pick<UniversalGraphNode, 'hash'>;

/**
 * Create new image node object (with new hash and default values)
 * @param partialImage - object to be transformed into image node (it will mutate)
 */
export const createImageNode =
  <IN extends Partial<UniversalGraphImageNodeTemplate>>(partialImage: IN) =>
    createNode(
      merge(
        IMAGE_DEFAULTS_FACTORY(),
        partialImage,
        {image_id: makeid()},
      )
    ) as ReturnType<typeof NODE_DEFAULTS_FACTORY> & ReturnType<typeof IMAGE_DEFAULTS_FACTORY> & IN &
      Pick<UniversalGraphNode, 'hash'> & Pick<UniversalGraphGroup, 'image_id'>;
