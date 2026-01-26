import { reactive, watchEffect, type Directive, type DirectiveBinding, type WatchStopHandle } from "vue";

/**
 * Resource highlight state - tracks which resources should glow
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
 * Highlight specific resources
 * @param resourceKeys - Array of resource keys to highlight (e.g., ['food', 'power'])
 * @param insufficientKeys - Array of resource keys that are insufficient (will glow red)
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
 * The element will glow when highlightResources(['food']) is called.
 * Uses CSS variable --resource-glow-color for the glow color.
 *
 * Modifiers:
 * - v-resource-glow.pulse - Adds a pulsing animation
 */
export const vResourceGlow: Directive<HTMLElement, string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    const resourceKey = binding.value;

    // Add base styles
    el.style.transition = "box-shadow 0.3s ease, transform 0.2s ease";
    el.dataset.resourceKey = resourceKey;

    // Set up reactive effect to watch highlight state
    const updateGlow = () => {
      const isHighlighted = highlightState.active && highlightState.resources.has(resourceKey);
      const isInsufficient = highlightState.active && highlightState.insufficient.has(resourceKey);

      if (isHighlighted) {
        const glowColor = isInsufficient
          ? "var(--resource-glow-insufficient, #f87171)"
          : `var(--resource-glow-color, var(--color-${resourceKey}, #60a5fa))`;

        el.style.boxShadow = `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`;
        el.style.transform = "scale(1.02)";
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
        el.style.boxShadow = "";
        el.style.transform = "";
        el.classList.remove("resource-highlighted", "resource-insufficient", "resource-pulse");
      }
    };

    // Use Vue's watchEffect to reactively update when highlightState changes
    const stopWatch = watchEffect(updateGlow);

    // Store the stop handle for cleanup
    (el as HTMLElement & { _resourceGlowStop?: WatchStopHandle })._resourceGlowStop = stopWatch;
  },

  unmounted(el: HTMLElement) {
    const stopWatch = (el as HTMLElement & { _resourceGlowStop?: WatchStopHandle })._resourceGlowStop;
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

  .resource-pulse {
    animation: resource-pulse 1.5s ease-in-out infinite;
  }

  @keyframes resource-pulse {
    0%, 100% {
      box-shadow: 0 0 8px var(--resource-glow-color, #60a5fa),
                  0 0 16px var(--resource-glow-color, #60a5fa);
    }
    50% {
      box-shadow: 0 0 12px var(--resource-glow-color, #60a5fa),
                  0 0 24px var(--resource-glow-color, #60a5fa);
    }
  }

  @keyframes insufficient-shake {
    0%, 100% { transform: translateX(0) scale(1.02); }
    25% { transform: translateX(-2px) scale(1.02); }
    75% { transform: translateX(2px) scale(1.02); }
  }
`;
