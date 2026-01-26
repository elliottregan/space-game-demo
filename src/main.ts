import { createApp } from "vue";
import App from "./renderer/App.vue";
import { resourceHighlightStyles, vResourceGlow } from "./renderer/directives/ResourceHighlight";
import router from "./renderer/router";
import "./renderer/ui/tokens/theme.css";

// Inject resource highlight styles
const styleEl = document.createElement("style");
styleEl.textContent = resourceHighlightStyles;
document.head.appendChild(styleEl);

const app = createApp(App);

// Register the resource glow directive globally
app.directive("resource-glow", vResourceGlow);

// Use router
app.use(router);

app.mount("#app");
