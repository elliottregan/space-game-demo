import {
  reactive,
  watchEffect,
  type Directive,
  type DirectiveBinding,
  type WatchStopHandle,
} from "vue";

/**
 * Resource highlight state - tracks which resources should be highlighted
 */
export const highlightState = reactive<{
  active: boolean;
  resources: Set<string>;
  insufficient: Set<string>;
  deltas: Record<string, number>;
}>({
  active: false,
  resources: new Set(),
  insufficient: new Set(),
  deltas: {},
});

/**
 * Resource accent colors matching ResourceBadge
 */
const RESOURCE_COLORS: Record<string, string> = {
  food: "#827717", // olive
  oxygen: "#00838F", // cyan
  water: "#1565C0", // blue
  power: "#F57C00", // amber
  materials: "#455A64", // slate
};

/**
 * Highlight specific resources
 * @param resourceKeys - Array of resource keys to highlight (e.g., ['food', 'power'])
 * @param insufficientKeys - Array of resource keys that are insufficient (will show red)
 * @param deltas - Object mapping resource keys to their one-time change amounts (positive or negative)
 */
export function highlightResources(
  resourceKeys: string[],
  insufficientKeys: string[] = [],
  deltas: Record<string, number> = {},
): void {
  highlightState.active = true;
  highlightState.resources = new Set(resourceKeys);
  highlightState.insufficient = new Set(insufficientKeys);

  // Clear existing deltas and add new ones in place for Vue reactivity
  for (const key of Object.keys(highlightState.deltas)) {
    delete highlightState.deltas[key];
  }
  for (const [key, value] of Object.entries(deltas)) {
    highlightState.deltas[key] = value;
  }
}

/**
 * Clear all resource highlights
 */
export function clearHighlights(): void {
  highlightState.active = false;
  highlightState.resources.clear();
  highlightState.insufficient.clear();
  for (const key of Object.keys(highlightState.deltas)) {
    delete highlightState.deltas[key];
  }
}

/**
 * v-resource-glow directive
 *
 * Usage: <div v-resource-glow="'food'">Food: 100</div>
 *
 * The element will get an outline when highlightResources(['food']) is called.
 * Uses the resource's accent color for the outline.
 *
 * Modifiers:
 * - v-resource-glow.pulse - Adds a pulsing animation
 */
export const vResourceGlow: Directive<HTMLElement, string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    const resourceKey = binding.value;

    // Add base styles
    el.style.transition = "outline 0.2s ease";
    el.style.outlineOffset = "-2px";
    el.dataset.resourceKey = resourceKey;

    // Set up reactive effect to watch highlight state
    const updateHighlight = () => {
      const isHighlighted = highlightState.active && highlightState.resources.has(resourceKey);
      const isInsufficient = highlightState.active && highlightState.insufficient.has(resourceKey);

      if (isHighlighted) {
        const outlineColor = isInsufficient
          ? "var(--g-color-negative, #c62828)"
          : RESOURCE_COLORS[resourceKey] || "#455A64";

        el.style.outline = `3px solid ${outlineColor}`;
        el.classList.add("resource-highlighted");

        if (isInsufficient) {
          el.classList.add("resource-insufficient");
        } else {
          el.classList.remove("resource-insufficient");
        }

        if (binding.modifiers.pulse) {
          el.classList.add("resource-pulse");
        }
      } else {
        // Fade out by setting transparent outline (allows transition)
        el.style.outline = "3px solid transparent";
        el.classList.remove("resource-highlighted", "resource-insufficient", "resource-pulse");
      }
    };

    // Use Vue's watchEffect to reactively update when highlightState changes
    const stopWatch = watchEffect(updateHighlight);

    // Store the stop handle for cleanup
    (el as HTMLElement & { _resourceGlowStop?: WatchStopHandle })._resourceGlowStop = stopWatch;
  },

  unmounted(el: HTMLElement) {
    const stopWatch = (el as HTMLElement & { _resourceGlowStop?: WatchStopHandle })
      ._resourceGlowStop;
    if (stopWatch) {
      stopWatch();
    }
  },
};

/**
 * CSS to inject for the directive animations
 */
export const resourceHighlightStyles = `
  .resource-highlighted {
    position: relative;
    z-index: 10;
  }

  .resource-insufficient {
    animation: insufficient-shake 0.5s ease-in-out;
  }

  @keyframes insufficient-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
`;
