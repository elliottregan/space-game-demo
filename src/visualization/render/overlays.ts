// src/visualization/render/overlays.ts
// Overlay and toast rendering functions

import { formatFilename } from "../formatters";
import { isDragging, getErrorMessage, isApiAvailable, getAvailableLogs } from "../state";

/**
 * Render the drag overlay.
 */
export function renderDragOverlay(): string {
  if (!isDragging()) return "";
  return `
    <div class="drop-overlay">
      <div class="drop-overlay-content">
        <div class="drop-overlay-icon">📊</div>
        <div class="drop-overlay-text">Drop to load analysis</div>
      </div>
    </div>
  `;
}

/**
 * Render the error toast.
 */
export function renderErrorToast(): string {
  const message = getErrorMessage();
  if (!message) return "";
  return `
    <div class="error-toast">
      ${message}
    </div>
  `;
}

/**
 * Render the server file list.
 */
export function renderServerFileList(): string {
  if (!isApiAvailable()) return "";
  const logs = getAvailableLogs();
  if (logs.length === 0) return "";

  return `
    <div class="server-files">
      <h3>Recent Simulations</h3>
      <div class="file-list">
        ${logs
          .slice(0, 10)
          .map(
            (file) => `
          <button class="file-list-item" data-file="${file}" data-target="a">
            ${formatFilename(file)}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Render the empty state (no files loaded).
 */
export function renderEmptyState(): string {
  return `
    <div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">📊</div>
      <div class="drop-zone-text">Drop simulation JSON or JSON.GZ here</div>
      <div class="drop-zone-hint">or</div>
      <button class="browse-btn" id="browse-btn">Browse files</button>
      ${renderServerFileList()}
    </div>
  `;
}
