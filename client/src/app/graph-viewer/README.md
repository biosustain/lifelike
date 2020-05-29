# Graph Viewer and Editor

This collection of files implements a framework for a graph editor and viewer.

```typescript
const style = new KnowledgeMapStyle();
const graphCanvas = new GraphCanvasView(canvasTag, style, style);
graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(graphCanvas), -100);
// ... more behaviors...
graphCanvas.backgroundFill = '#f2f2f2';
graphCanvas.startParentFillResizeListener();
graphCanvas.startAnimationLoop(); // Note: If calling from Angular, call outside Angular with ngZone

// When done:
graphCanvas.destroy();
```

## Organization

* [renderers/](renderers/) - The renderers themselves and the starting point of all this code
* [styles/](styles/) - Renderers use style objects to convert graph data into drawing primitives that
    have metrics (width, height, bbox) and draw() methods
* [actions/](actions/) - `Actions` abstract user-initiated *actions* so they can be rolled back or redone --
    when you need to record something the user did, create an action and call `renderer.execute(action)`
* [utils/](utils/) - Utility methods used by the graph viewer
    * [canvas/](utils/canvas/) - Where most of the HTML5 canvas drawing routines are actually stored
