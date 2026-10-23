<script setup lang="ts">
import { ref, watch } from 'vue'
import { FACILITY_ART, type FacilityKind } from '../render/facilityArtSpec'
const props = defineProps<{ kind: FacilityKind }>()
const failed = ref(false)
watch(() => props.kind, () => { failed.value = false })
</script>

<template>
  <div v-if="!failed" class="facility-preview" :data-facility="kind" :style="{ aspectRatio: FACILITY_ART[kind].aspect }">
    <img v-for="(layer, index) in FACILITY_ART[kind].layers" :key="`${kind}-${index}`" :src="layer.url" :data-art-role="layer.role" alt="" :draggable="false" @error="failed = true" :style="{ left: `${layer.left * 100}%`, top: `${layer.top * 100}%`, width: `${layer.width * 100}%`, height: `${layer.height * 100}%` }" />
  </div>
  <p v-else class="unavailable">图片暂时没显示，仍可查看材料和开工。</p>
</template>

<style scoped>
.facility-preview { position: relative; width: 100%; max-width: 210px; margin: 0 auto; }
.facility-preview img { position: absolute; object-fit: fill; user-select: none; }
.unavailable { font-size: 12px; color: #61796b; }
</style>
