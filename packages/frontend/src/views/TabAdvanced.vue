<template>
  <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-4">Advanced</h2>
    <div class="w-full flex flex-col gap-6 items-center">
      <div class="flex items-center gap-3">
        <span class="font-semibold text-gray-700">Enable Secret Detector</span>
        <input type="checkbox" v-model="enabled" @change="toggleTool" class="w-6 h-6 accent-[#1976d2]" />
      </div>
      <Button label="Analyze Past HTTP Traffic" :loading="analyzing" @click="analyzeHistory" class="font-bold" style="background:#1976d2;color:#fff;min-width:220px;box-shadow:0 2px 8px #1976d233;" />
      <div v-if="analyzeResult" class="text-green-700 font-semibold text-center">{{ analyzeResult }}</div>
      <div v-if="error" class="text-red-500 font-semibold text-center">{{ error }}</div>
    </div>
    <div class="w-full flex flex-col gap-2 mt-8">
      <label class="font-semibold text-gray-700 mb-1">Excluded File Extensions (comma-separated)</label>
      <input
        v-model="excludedInput"
        @keydown.enter.prevent="saveExcluded"
        type="text"
        class="w-full border rounded px-3 py-2 text-black bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1976d2]"
        placeholder="e.g. .png, .jpg, .css"
      />
      <div class="flex gap-2 mt-2">
        <Button label="Save Extensions" @click="saveExcluded" :loading="savingExcluded" class="font-bold" style="background:#1976d2;color:#fff;min-width:140px;" />
        <Button label="Reset" @click="resetExcluded" class="font-bold" style="background:#eee;color:#333;min-width:80px;" />
      </div>
      <div v-if="excludedSaved" class="text-green-700 font-semibold text-center">Extensions saved!</div>
      <div v-if="excludedError" class="text-red-500 font-semibold text-center">{{ excludedError }}</div>
      <div v-if="excludedList.length" class="text-xs text-gray-500 mt-1">Current: {{ excludedList.join(', ') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import Button from "primevue/button";
import { useSDK } from "../plugins/sdk";

const sdk = useSDK();
const enabled = ref(true);
const analyzing = ref(false);
const analyzeResult = ref("");
const error = ref("");
const excludedInput = ref("");
const excludedList = ref<string[]>([]);
const excludedSaved = ref(false);
const excludedError = ref("");
const savingExcluded = ref(false);

async function toggleTool() {
  try {
    await sdk.backend.setToolEnabled(enabled.value);
  } catch (e) {
    error.value = "Failed to update tool state.";
  }
}

async function analyzeHistory() {
  analyzing.value = true;
  analyzeResult.value = "";
  error.value = "";
  try {
    const res = await sdk.backend.analyzeHttpHistory();
    analyzeResult.value = res && res.summary ? res.summary : "Analysis complete.";
  } catch (e) {
    error.value = "Failed to analyze HTTP history.";
  }
  analyzing.value = false;
}

watch(excludedInput, (val) => {
  excludedSaved.value = false;
  excludedError.value = "";
});

async function saveExcluded() {
  savingExcluded.value = true;
  excludedSaved.value = false;
  excludedError.value = "";
  try {
    const extensions = excludedInput.value
      .split(",")
      .map(e => e.trim())
      .filter(e => e.length > 0);
    await (sdk.backend as any).setExcludedExtensions(extensions);
    excludedSaved.value = true;
    await loadExcluded();
  } catch (e) {
    excludedError.value = "Failed to save extensions.";
  }
  savingExcluded.value = false;
}

async function loadExcluded() {
  excludedError.value = "";
  excludedSaved.value = false;
  savingExcluded.value = false;
  try {
    const res = await sdk.backend.getExcludedExtensions();
    excludedList.value = Array.isArray(res) ? res : [];
    excludedInput.value = excludedList.value.join(", ");
  } catch (e) {
    excludedError.value = "Failed to load extensions.";
  }
}

async function resetExcluded() {
  savingExcluded.value = true;
  excludedSaved.value = false;
  excludedError.value = "";
  try {
    await (sdk.backend as any).setExcludedExtensions([]);
    excludedList.value = [];
    excludedInput.value = "";
    excludedSaved.value = true;
  } catch (e) {
    excludedError.value = "Failed to reset extensions.";
  }
  savingExcluded.value = false;
}

onMounted(() => {
  loadExcluded();
});
</script>
