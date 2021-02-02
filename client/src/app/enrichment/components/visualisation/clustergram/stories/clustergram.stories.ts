import {moduleMetadata, Story} from '@storybook/angular';
import {withKnobs} from '@storybook/addon-knobs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {ClustergramComponent} from "../clustergram.component";
import mockedData from "../../stories/assets/mocked_data.json";

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Enrichment/Visualisation/ClustergramComponent',  // The component related to the Stories
  component: ClustergramComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        ClustergramComponent
      ],
      imports: [
        FormsModule,
        ReactiveFormsModule,
        NgbModule
      ]
    }),
  ]
};// This creates a Story for the component

const Template: Story<ClustergramComponent> = (args) => ({
  component: ClustergramComponent,
  props: args,
  template: `
    <app-clustergram
        style='display:block;height:100vh;'
        [data]="data"
    >
    </app-clustergram>
  `,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {
  data: mockedData.data
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
