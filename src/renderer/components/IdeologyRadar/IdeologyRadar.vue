<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { getDominantFactionInfo, FACTION_HEX_COLORS } from "../../utils/ideologyDisplay";
import { renderRadar, type RadarData } from "./renderRadar";

const props = withDefaults(
  defineProps<{
    values: { solidarity: number; sovereignty: number; transformation: number };
    size?: number;
    fillColor?: string;
    showLabels?: boolean;
    showGrid?: boolean;
  }>(),
  {
    size: 80,
    fillColor: undefined,
    showLabels: false,
    showGrid: true,
  },
);

const svgRef = ref<SVGSVGElement | null>(null);

const resolvedColor = computed(() => {
  if (props.fillColor) return props.fillColor;
  const info = getDominantFactionInfo(props.values);
  if (info) {
    return FACTION_HEX_COLORS[info.faction];
  }
  return FACTION_HEX_COLORS.neutral;
});

function render() {
  if (!svgRef.value) return;
  const data: RadarData = {
    solidarity: props.values.solidarity,
    sovereignty: props.values.sovereignty,
    transformation: props.values.transformation,
  };
  renderRadar(svgRef.value, data, {
    size: props.size,
    fillColor: resolvedColor.value,
    showLabels: props.showLabels,
    showGrid: props.showGrid,
  });
}

onMounted(render);
watch(
  [
    () => props.values,
    () => props.size,
    resolvedColor,
    () => props.showLabels,
    () => props.showGrid,
  ],
  render,
  {
    deep: true,
  },
);
</script>

<template>
  <svg ref="svgRef" class="ideology-radar" />
</template>

<style scoped>
.ideology-radar {
  width: 100%;
  height: auto;
}
</style>
