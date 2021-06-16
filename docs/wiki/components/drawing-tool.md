# Drawing Tool

The drawing tool consists of the graph renderer and the editor UI.

## Data Model

Goals of the data model include:

* Semantic
* Generic
* Portable to other graph tools
* Well defined

Graphs in the drawing tool can exist in 3 stages:

1. The serialization representation (the JSON data saved to and loaded from the server)
2. The in-memory data representation (when the JSON data is loaded and turned into JS objects)
3. The in-memory rendering representation (when the nodes and edges are actually positioned and it's decided what will actually be drawn)

Ever since the graph renderer was converted to use D3.js, the in-memory representation of the graph (#2) is the same as the serialized representation (#1).

### Notes on the Data Representation

The drawing tool was originally strongly based off of Neo4j's data model and you will find Neo4j terminology (like node type being described as "label" and "sub_labels"). This is somewhat contrary to the goal of creating a generic graph format but migration (at this point) would bring little gain.

Within nodes and edges, you will find:

* Semantic properties (type of node, title, etc.)
* Style properties (line width, color, etc.)
* Combination semantic and style properties (font icons)

The only combination semantic and style property is the "icon" property but it is deprecated because it is not portable and the property should be removed in the future.

There are some incorrect field names (i.e. "domain" for links doesn't mean the domain of the site -- it means the text of the hyperlink) that also are in violation of being the format being well-defined, and migration should be considered in the future.

## Renderer

Goals of the renderer include:

* Scaling well to very large graphs (WIP)
* Asynchronous rendering that can be split over several ticks
* High extensibility
* Support for interactive video, image, and charting nodes (WIP)
* Support clustering and grouping (WIP)

Originally the renderer was built using Vis.js, but eventually it was converted to use D3.js to give greater control over the editor.

The current drawing tool renders to a <canvas> tag and uses D3.js heavily for positioning, panning and zooming.

### Code Structure

`GraphView` is the abstract bases class that represents the graph viewer/editor, but it does not implement any rendering with the intention that SVG or other renderers may be implemented eventually. As of right now, the only concrete renderer is `CanvasGraphView`.

Initialization of the graph component involves:

1. Creating an instance of `CanvasGraphView` with a `<canvas>` DOM element and a "style handler" that does all the actual node and edge drawing (see `KnowledgeMapStyle`).

2. "Graph behaviors" are registered with the graph. Behaviors add features like dragging, resizing, copying, and pasting to the component.

3. Activate the resize listener and start the animation loop:

   ```typescript
   graphCanvas.startParentFillResizeListener();
   graphCanvas.startAnimationLoop();
   ```

### The Rendering Process

When a node needs (`UniversalGraphNode`) to be drawn, `placeNode()` gets called and all the metrics are calculated (like the size of the text or the size of the rounded rectangle) and a `PlacedNode` object is returned that has a `draw()` method. (`PlacedNode` is #3 from the data model.)

The returned `PlacedNode` then is cached for long as possible in `CanvasGraphView`. The cached copy is theoretically valid as long as the node itself or canvas zoom doesn't change.

`PlacedNode` is useful as an intermediate object because it allows certain operations like finding which objects intersect a click. It also caches the most expensive part of rendering: calculating the shape and text metrics based on the current pan and zoom.

Actual drawing to the canvas happens in the rendering loop asynchronously whenever CanvasGraphView senses that it can without freezing the browser UI. Only one node could be drawn in a tick or 200 could be drawn. CanvasGraphView manages of queue of "things that have to be drawn" and knows how to invalidate this list if changes are made to the graph (however, this also has not been fully optimized yet so it also errs on the side of caution).

Edges work the same way with `PlacedEdge`s.

The entire process has been designed with the intention of allowing caching as much as possible for every step of the process and to permit rendering large graphs over several ticks.

### Behaviors

Dragging, resizing, copying, pasting and other functionality are encapsulated in **behaviors**. This allows users of the renderer to pick and choose the behaviors that are relevant. For example, the read-only view for the drawing tool does not "install" the resize behavior.

Behaviors are merely classes that have entry points for different events (click, drag start, drag end, etc.) and behaviors implement the necessary event handlers.

Behaviors could be improved in a few ways:

* Implementing additional types of events is not entirely straight forward
* Some high-frequency events go through a secondary code path (there should ideally only be one code path)