import { createApp } from "vue";
import App from "./renderer/App.vue";
import { vResourceGlow, resourceHighlightStyles } from "./renderer/directives/ResourceHighlight";

// Inject resource highlight styles
const styleEl = document.createElement("style");
styleEl.textContent = resourceHighlightStyles;
document.head.appendChild(styleEl);

const app = createApp(App);

// Register the resource glow directive globally
app.directive("resource-glow", vResourceGlow);

app.mount("#app");
