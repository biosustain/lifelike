// also exported from '@storybook/angular' if you can deal with breaking changes in 6.1
import Button from './button.component';
import {Meta, Story} from '@storybook/angular';

export default {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    backgroundColor: {control: 'color'},
  },
} as Meta;

const Template: Story<Button> = (args: Button) => ({
  component: Button,
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'Button',
};

export const Secondary = Template.bind({});
Secondary.args = {
  label: 'Button',
};

export const Large = Template.bind({});
Large.args = {
  size: 'large',
  label: 'Button',
};

export const Small = Template.bind({});
Small.args = {
  size: 'small',
  label: 'Button',
};
