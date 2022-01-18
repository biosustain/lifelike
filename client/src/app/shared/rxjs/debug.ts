// @ts-nocheck
import { create } from 'rxjs-spy';
import DevToolsPlugin from 'rxjs-spy-devtools-plugin';

const spy = create();
const devtoolsPlugin = new DevToolsPlugin(spy, {
  verbose: true,
});
spy.plug(devtoolsPlugin);

// We must teardown the spy if we're hot-reloading:
if (module.hot) {
  if (module.hot) {
    module.hot.dispose(() => {
      spy.teardown();
    });
  }
}
