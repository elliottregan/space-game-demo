# Visualizer Static Deployment Design

Deploy the simulation visualizer as a standalone static site with drag-and-drop JSON file loading.

## Goals

- Build visualizer as separate static site alongside main game
- Support drag-and-drop and file picker for loading JSON analysis files
- No server-side API required - purely client-side

## Build Configuration

### New Vite Config: `vite.visualizer.config.ts`

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src/visualization",
  base: process.env.VITE_VISUALIZER_BASE || "/",
  build: {
    outDir: "../../dist/visualizer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

### Package Scripts

```json
{
  "build:visualizer": "vite build --config vite.visualizer.config.ts",
  "preview:visualizer": "vite preview --config vite.visualizer.config.ts"
}
```

## File Loading UI

### States

1. **Empty** - Large centered drop zone with instructions and browse button
2. **Loaded** - Compact header with file info and option to load different file
3. **Dragging** - Full-page overlay with drop indicator

### Interaction Flow

1. User drops JSON file or clicks browse button
2. File validated against `AnalysisOutput` type structure
3. On success: load into Batch A, render charts
4. On error: show toast with message
5. "Compare" button appears after Batch A loaded
6. Same flow for Batch B

## Code Changes

### Modified Files

**`src/visualization/app.ts`**
- Remove `fetchLogs()` and `fetchLog()` server API calls
- Add `loadFile(file: File): Promise<AnalysisOutput>` using FileReader
- Add drag-and-drop handlers: dragover, dragleave, drop
- Add file input change handler
- Update `render()` for empty/loaded/dragging states

**`src/visualization/index.html`**
- Change script src to `/app.ts` for Vite dev
- Add hidden file input: `<input type="file" id="file-input" accept=".json" hidden>`

**`src/visualization/styles.css`**
- `.drop-zone` - dashed border, centered content, hover highlight
- `.drop-overlay` - fixed full-page overlay during drag
- `.file-info` - compact display of loaded filename
- `.error-toast` - temporary error message display

### New Files

**`vite.visualizer.config.ts`** - Vite build config for visualizer

### Unchanged

- `scripts/visualize.ts` - Dev server remains for local API-based workflow
- Chart modules - No changes needed
- `src/visualization/types.ts` - No changes needed

## Implementation Tasks

1. Create `vite.visualizer.config.ts`
2. Add package.json scripts
3. Update `index.html` for Vite compatibility
4. Add file loading logic to `app.ts`
5. Add drag-and-drop UI and handlers to `app.ts`
6. Add styles for drop zone and states
7. Test build and verify charts work with dropped files
