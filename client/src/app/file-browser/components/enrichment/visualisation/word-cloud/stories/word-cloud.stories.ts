import {moduleMetadata, Story} from '@storybook/angular';
import {withKnobs} from '@storybook/addon-knobs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {WordCloudComponent} from "../word-cloud.component";

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Enrichment/Visualisation/WordCloudComponent',  // The component related to the Stories
  component: WordCloudComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        WordCloudComponent
      ],
      imports: [
        FormsModule,
        ReactiveFormsModule,
        NgbModule
      ]
    }),
  ]
};// This creates a Story for the component

const Template: Story<WordCloudComponent> = (args) => ({
  component: WordCloudComponent,
  props: args,
  template: `
    <app-word-cloud
        style='display:block;height:100vh;'
        [data]="data"
    >
    </app-word-cloud>
  `,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {
  data: [
    {
      text: "sfagrsg",
      frequency: 1
    },
    {
      text: "sfafwefwgrsg",
      frequency: 16
    },
    {
      // text: "Sdrgerg",
      frequency: 12
    }
  ]
};

export const ArrayOfStrings = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
ArrayOfStrings.args = {
  data: [
    "sfagrsg", "sfafwefwgrsg","", String("fasdf")
  ]
};

export const ArrayOfEverything = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
ArrayOfEverything.args = {
  data: [
    "sfagrsg", "sfafwefwgrsg","",null, undefined, NaN, 123, {}
  ]
};
