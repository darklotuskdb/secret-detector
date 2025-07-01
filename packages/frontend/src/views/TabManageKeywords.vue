<script setup lang="ts">
import { ref, computed } from "vue";
import { useSDK } from "@/plugins/sdk";
import Button from "primevue/button";

const sdk = useSDK();
const customKeywords = ref<string[]>([]);
const loading = ref(false);
const error = ref("");
const page = ref(1);
const pageSize = 10;

const fetchKeywords = async () => {
  loading.value = true;
  error.value = "";
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    customKeywords.value = Array.isArray(stored) ? stored : [];
  } catch (e) {
    error.value = "Failed to load custom keywords.";
  } finally {
    loading.value = false;
  }
};

const refresh = fetchKeywords;

const totalPages = computed(() => Math.ceil(customKeywords.value.length / pageSize));
const pagedKeywords = computed(() => {
  const start = (page.value - 1) * pageSize;
  return customKeywords.value.slice(start, start + pageSize);
});
const nextPage = () => { if (page.value < totalPages.value) page.value++; };
const prevPage = () => { if (page.value > 1) page.value--; };

const removeKeyword = async (kw: string) => {
  customKeywords.value = customKeywords.value.filter(k => k !== kw);
  loading.value = true;
  error.value = "";
  try {
    await sdk.backend.setCriticalKeywords(customKeywords.value);
    await fetchKeywords();
  } catch (e) {
    error.value = "Failed to remove keyword.";
  } finally {
    loading.value = false;
  }
};

const removeAll = async () => {
  loading.value = true;
  error.value = "";
  try {
    customKeywords.value = [];
    await sdk.backend.setCriticalKeywords([]);
    await fetchKeywords();
  } catch (e) {
    error.value = "Failed to remove all keywords.";
  } finally {
    loading.value = false;
  }
};

fetchKeywords();
</script>

<template>
  <div class="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-4">Manage Keywords</h2>
    <div class="flex w-full justify-between items-center mb-4">
      <Button label="Refresh" @click="refresh" class="font-bold" style="background:#1976d2;color:#fff;min-width:90px;" />
      <span class="text-black font-semibold text-center w-full">
        Total custom keywords: <span class="text-lg font-extrabold">{{ customKeywords.length }}</span>
      </span>
      <Button label="Remove All" @click="removeAll" class="font-bold" style="background:#e53935;color:#fff;min-width:110px;" :disabled="customKeywords.length === 0 || loading" />
    </div>
    <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
    <div v-if="loading" class="text-gray-700 mb-2">Loading...</div>
    <div v-if="!loading && !pagedKeywords.length" class="text-gray-500">No custom keywords found.</div>
    <ul class="w-full divide-y divide-gray-200 mb-4">
      <li v-for="kw in pagedKeywords" :key="kw" class="py-2 text-black font-semibold flex items-center justify-between">
        <span>{{ kw }}</span>
        <Button label="Remove" @click="removeKeyword(kw)" class="ml-4 font-bold" style="background:#e53935;color:#fff;border-radius:0.375rem;padding:0.25rem 1rem;min-width:90px;" />
      </li>
    </ul>
    <div class="flex gap-4 items-center mt-2" v-if="totalPages > 1">
      <Button label="Previous" @click="prevPage" :disabled="page === 1" />
      <span>Page {{ page }} of {{ totalPages }}</span>
      <Button label="Next" @click="nextPage" :disabled="page === totalPages" />
    </div>
  </div>
</template>
