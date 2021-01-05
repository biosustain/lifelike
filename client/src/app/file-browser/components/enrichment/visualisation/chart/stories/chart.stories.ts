import {moduleMetadata, Story} from '@storybook/angular';
import {withKnobs} from '@storybook/addon-knobs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {ChartComponent} from "../chart.component";
import { ChartsModule } from 'ng2-charts';

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Enrichment/Visualisation/ChartComponent',  // The component related to the Stories
  component: ChartComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        ChartComponent
      ],
      imports: [
        FormsModule,
        ReactiveFormsModule,
        NgbModule,
        ChartsModule
      ]
    }),
  ]
};// This creates a Story for the component

const Template: Story<ChartComponent> = (args) => ({
  component: ChartComponent,
  props: args,
  template: `
    <app-chart
        style='display:block;height:100vh;'
        [data]="data"
    >
    </app-chart>
  `,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {
  data: [
    {
      name: "sfagrsg",
      "P-value": 2
    },
    {
      name: "sfafwefwgrsg",
      "P-value": 0.16,
      "Adjusted P-value": 1/10
    },
    {
      name: "Sdrgerg",
      "Adjusted P-value": 1/12,
      "P-value": 0.123
    }
  ]
};
