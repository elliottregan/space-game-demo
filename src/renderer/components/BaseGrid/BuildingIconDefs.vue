<!-- src/renderer/components/BaseGrid/BuildingIconDefs.vue -->
<!--
  Renders Lucide icons as SVG symbols for use with <use href="#icon-...">
  This allows D3-rendered SVG to reference Vue-rendered icons.
-->
<script setup lang="ts">
import { BuildingId } from "../../../core/models/Building";
import {
  House,
  SolarPanel,
  Droplet,
  Sprout,
  Pickaxe,
  Wind,
  Leaf,
  Recycle,
  FlaskConical,
  Building,
  Factory,
  Printer,
  Gem,
  Atom,
  Dna,
  Stethoscope,
  Snowflake,
  Sofa,
  Dumbbell,
  Flower,
  Telescope,
  Landmark,
  Rocket,
  Globe,
  TowerControl,
  Truck,
} from "lucide-vue-next";

const icons = [
  { id: BuildingId.HABITAT, component: House },
  { id: BuildingId.SOLAR_PANEL, component: SolarPanel },
  { id: BuildingId.WATER_EXTRACTOR, component: Droplet },
  { id: BuildingId.BASIC_FARM, component: Sprout },
  { id: BuildingId.BASIC_MINE, component: Pickaxe },
  { id: BuildingId.OXYGEN_GENERATOR, component: Wind },
  { id: BuildingId.GREENHOUSE, component: Leaf },
  { id: BuildingId.WATER_RECLAIMER, component: Recycle },
  { id: BuildingId.RESEARCH_LAB, component: FlaskConical },
  { id: BuildingId.ADVANCED_HABITAT, component: Building },
  { id: BuildingId.AUTOMATED_FACTORY, component: Factory },
  { id: BuildingId.FABRICATOR_3D, component: Printer },
  { id: BuildingId.MINING_STATION, component: Gem },
  { id: BuildingId.NUCLEAR_REACTOR, component: Atom },
  { id: BuildingId.BIOLAB, component: Dna },
  { id: BuildingId.MEDICAL_CENTER, component: Stethoscope },
  { id: BuildingId.CRYO_FACILITY, component: Snowflake },
  { id: BuildingId.COMMON_ROOM, component: Sofa },
  { id: BuildingId.GYMNASIUM, component: Dumbbell },
  { id: BuildingId.HYDROPONIC_GARDEN, component: Flower },
  { id: BuildingId.OBSERVATORY_DOME, component: Telescope },
  { id: BuildingId.ASSEMBLY_HALL, component: Landmark },
  { id: BuildingId.ROVER_DEPOT, component: Truck },
  { id: BuildingId.GENERATION_SHIP, component: Rocket },
  { id: BuildingId.UNITED_MARS_STATION, component: Globe },
  { id: BuildingId.SPACE_ELEVATOR, component: TowerControl },
];
</script>

<template>
  <svg class="icon-defs" aria-hidden="true">
    <defs>
      <symbol
        v-for="icon in icons"
        :id="`building-icon-${icon.id}`"
        :key="icon.id"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <component :is="icon.component" />
      </symbol>
    </defs>
  </svg>
</template>

<style scoped>
.icon-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
