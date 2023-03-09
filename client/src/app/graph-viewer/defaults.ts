import { GROUP_LABEL, IMAGE_LABEL } from 'app/shared/constants';

// Use factory so it might contain muttable parameters
export const NODE_DEFAULTS_FACTORY = () => ({
  display_name: "",
  sub_labels: [],
  data: {
    x: 0,
    y: 0,
  },
});

// Use factory so it might contain muttable parameters
export const GROUP_DEFAULTS_FACTORY = () => ({
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

// Use factory so it might contain muttable parameters
export const IMAGE_DEFAULTS_FACTORY = () => ({
  label: IMAGE_LABEL,
});
