<template>
  <div class="save-slot-menu" :class="{ open }">
    <button class="slot-trigger" @click="open = !open">
      <span class="slot-label">{{ activeSlot ? activeSlot.label : "No save" }}</span>
      <span class="slot-caret">▾</span>
    </button>
    <div v-if="open" class="slot-dropdown" @click.self="open = false">
      <div class="slot-header">Saves ({{ slots.length }} / {{ maxSlots }})</div>
      <ul class="slot-list">
        <li v-if="slots.length === 0" class="slot-row empty">No saves yet.</li>
        <li
          v-for="slot in slotsSorted"
          :key="slot.id"
          :class="['slot-row', { active: slot.id === activeSlotId }]"
        >
          <button
            class="slot-switch"
            :title="`Created ${formatDate(slot.createdAt)} · last played ${formatDate(slot.lastPlayedAt)}`"
            @click="onSwitch(slot.id)"
          >
            <span class="slot-row-label">{{ slot.label }}</span>
            <span class="slot-row-time">{{ formatRelative(slot.lastPlayedAt) }}</span>
          </button>
          <button
            class="slot-delete"
            :disabled="slots.length <= 1"
            :title="slots.length <= 1 ? 'Cannot delete the only save' : 'Delete this save'"
            @click="onDelete(slot.id)"
          >
            ×
          </button>
        </li>
      </ul>
      <div class="slot-footer">
        <button class="primary" :disabled="slots.length >= maxSlots" @click="onNew">
          + New Campaign
        </button>
        <span v-if="slots.length >= maxSlots" class="slot-hint">
          Max {{ maxSlots }} saves — delete one first.
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import type { SaveSlot } from "../../../facade/persistence.ts";
import { formatDate, formatRelative } from "../../util/time.ts";

const props = defineProps<{
  slots: SaveSlot[];
  activeSlotId: string | null;
  maxSlots: number;
}>();

const emit = defineEmits<{
  switchSlot: [id: string];
  newSlot: [];
  deleteSlot: [id: string];
}>();

const open = ref(false);

const activeSlot = computed(() => props.slots.find((s) => s.id === props.activeSlotId));

const slotsSorted = computed(() =>
  [...props.slots].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
);

function onSwitch(id: string): void {
  if (id !== props.activeSlotId) emit("switchSlot", id);
  open.value = false;
}

function onNew(): void {
  emit("newSlot");
  open.value = false;
}

function onDelete(id: string): void {
  if (props.slots.length <= 1) return;
  if (confirm("Delete this save? This cannot be undone.")) {
    emit("deleteSlot", id);
  }
}

function onClickOutside(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest(".save-slot-menu");
  if (!el) open.value = false;
}

onMounted(() => document.addEventListener("click", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>
