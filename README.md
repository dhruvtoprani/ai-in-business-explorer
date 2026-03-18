# AI Business Dataset Explorer

An interactive local web app for exploring the AI-in-business simulation runs, config groups, and controlled feedback families collected from the project archive.

## What it does

- Explore run-level, configuration-level, and control-family views
- Compare models, feedback settings, grid sizes, task variety, and density
- Switch between scatter, bar, box, and heatmap visualizations
- Inspect clicked-point details in a dedicated focus panel
- View the always-on correlation matrix and lower analysis panels
- Use an accessibility-friendly color mode with higher contrast and safer palettes

## Project Structure

- `index.html` - application shell and controls
- `styles.css` - layout, theme, and chart styling
- `app.js` - data loading, filtering, chart rendering, and interaction logic
- `data/ai_business_dataset.json` - raw curated dataset
- `data/ai_business_dataset.js` - browser-friendly data bundle

## How to Run

Open `index.html` in a modern browser, or serve the folder with any static file server.

Example:

```bash
cd /Users/dhruvtoprani/Desktop/Projects/ai-business-explorer
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Included Views

- Run logs
- Configuration summaries
- Controlled feedback families
- Correlation matrix
- Insight panels for overview, model summary, feedback families, and top configurations

## Notes

- The explorer is built around the curated simulation outputs from the AI-in-business dataset archive.
- Accessibility mode uses a color-blind-safe palette and higher contrast styling.
- The correlation matrix remains visible in the main analysis stack by design.
