<script setup lang="ts">
import Button from "primevue/button";
import Textarea from "primevue/textarea";
import { ref, onMounted } from "vue";
import { useSDK } from "@/plugins/sdk";

const sdk = useSDK();
const criticalKeywords = ref<string[]>([]);
const inputKeywords = ref("");
const loading = ref(false);
const error = ref("");
const importError = ref("");

const fetchKeywords = async () => {
  loading.value = true;
  error.value = "";
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    criticalKeywords.value = Array.isArray(stored) ? stored : [];
  } catch (e) {
    error.value = "Failed to load keywords.";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchKeywords);

const addAndSaveKeywords = async () => {
  const newWords = inputKeywords.value
    .split(/[\n,]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && !criticalKeywords.value.includes(w));
  if (newWords.length > 0) {
    criticalKeywords.value.push(...newWords);
    inputKeywords.value = "";
    await saveKeywords();
  }
};

const saveKeywords = async () => {
  loading.value = true;
  error.value = "";
  try {
    await sdk.backend.setCriticalKeywords(criticalKeywords.value);
    await fetchKeywords();
  } catch (e) {
    error.value = "Failed to save keywords.";
  } finally {
    loading.value = false;
  }
};

const handleFileUpload = async (e: Event) => {
  importError.value = "";
  const files = (e.target as HTMLInputElement).files;
  if (!files || !files[0]) return;
  const file = files[0];
  if (!file.name.endsWith('.txt')) {
    importError.value = "Only .txt files are supported.";
    return;
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const newWords = lines.filter(w => !criticalKeywords.value.includes(w));
  if (newWords.length > 0) {
    criticalKeywords.value.push(...newWords);
    await saveKeywords();
  }
};
</script>

<template>
  <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-2">Critical Secret Keywords</h2>
    <p class="text-gray-700 mb-4 text-center">Add keywords (comma or newline separated) or import from a .txt file.</p>
    <Textarea v-model="inputKeywords" rows="3" placeholder="Enter keywords or patterns..." class="w-full border border-gray-300 rounded mb-2 text-black font-semibold focus:border-black focus:ring-2 focus:ring-black" />
    <div class="flex gap-2 w-full mb-4">
      <Button label="Add & Save" @click="addAndSaveKeywords" :disabled="!inputKeywords.trim()" class="w-1/2 font-bold" style="background:#111;color:#fff;" />
      <label class="w-1/2 flex flex-col items-center justify-center cursor-pointer font-bold" style="background:#1976d2;color:#fff;border-radius:0.375rem;padding:0.25rem 1rem;min-width:90px;">
        <span>Import .TXT</span>
        <input type="file" accept=".txt" @change="handleFileUpload" class="hidden" />
      </label>
    </div>
    <div class="w-full text-center mt-2 mb-2">
      <span class="font-bold text-black">Total critical keywords loaded:</span>
      <span class="text-lg font-extrabold text-black ml-1">{{ criticalKeywords.length }}</span>
    </div>
    <div v-if="importError" class="text-red-500 text-xs mb-2">{{ importError }}</div>
    <div v-if="error" class="text-red-500 mt-2">{{ error }}</div>
    <div v-if="loading" class="text-gray-700 mt-2">Loading...</div>
  </div>
</template>
