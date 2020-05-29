# Canvas Renderer

Renders using a HTML5 `<canvas>` tag.

```typescript
const style = new KnowledgeMapStyle();
const graphCanvas = new GraphCanvasView(canvasChild.nativeElement as HTMLCanvasElement, style, style);
graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(graphCanvas), -100);
// ... more behaviors...
graphCanvas.backgroundFill = '#f2f2f2';
graphCanvas.startParentFillResizeListener();
```
