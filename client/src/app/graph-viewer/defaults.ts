import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GROUP_LABEL, IMAGE_LABEL } from 'app/shared/constants';
import { freezeDeep } from 'app/shared/utils';

export const NODE_DEFAULTS = freezeDeep({
  display_name: '',
  sub_labels: [],
  data: {
    x: 0,
    y: 0
  }
});

export const GROUP_DEFAULTS = freezeDeep({
  margin: 10,
  label: GROUP_LABEL,
  // This data depends on members, fill as placeholder
  data: {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  },
});

export const IMAGE_DEFAULTS = freezeDeep({
  label: IMAGE_LABEL,
});
