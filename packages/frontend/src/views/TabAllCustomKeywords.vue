<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useSDK } from "@/plugins/sdk";
import Button from "primevue/button";

const props = defineProps<{ refreshKey?: number }>();
const sdk = useSDK();
const criticalKeywords = ref<{ keyword: string; isRegex?: boolean }[]>([]);
const loading = ref(false);
const error = ref("");
const page = ref(1);
const pageSize = 10;

const fetchKeywords = async () => {
  loading.value = true;
  error.value = "";
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    if (Array.isArray(stored) && typeof stored[0] === "string") {
      criticalKeywords.value = (stored as string[]).map(k => ({ keyword: k }));
    } else if (Array.isArray(stored) && typeof stored[0] === "object" && stored[0] !== null && 'keyword' in stored[0]) {
      criticalKeywords.value = stored as { keyword: string; isRegex?: boolean }[];
    } else {
      criticalKeywords.value = [];
    }
  } catch (e) {
    error.value = "Failed to load keywords.";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchKeywords);

watch(() => props.refreshKey, () => {
  fetchKeywords();
});

const totalPages = computed(() => Math.ceil(criticalKeywords.value.length / pageSize));
const pagedKeywords = computed(() => {
  const start = (page.value - 1) * pageSize;
  return criticalKeywords.value.slice(start, start + pageSize);
});
const nextPage = () => { if (page.value < totalPages.value) page.value++; };
const prevPage = () => { if (page.value > 1) page.value--; };

const removeKeyword = async (kw: { keyword: string; isRegex?: boolean }) => {
  loading.value = true;
  error.value = "";
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    let all: { keyword: string; isRegex?: boolean }[] = Array.isArray(stored) && typeof stored[0] === "string"
      ? (stored as string[]).map(k => ({ keyword: k }))
      : (Array.isArray(stored) ? stored as { keyword: string; isRegex?: boolean }[] : []);
    all = all.filter(item => !(item.keyword === kw.keyword && !!item.isRegex === !!kw.isRegex));
    await sdk.backend.setCriticalKeywords(all as any);
    await fetchKeywords();
  } catch (e) {
    error.value = "Failed to remove keyword.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-4">All Custom Keywords</h2>
    <div class="mb-2 text-black font-semibold">Total: {{ criticalKeywords.length }}</div>
    <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
    <div v-if="loading" class="text-gray-700 mb-2">Loading...</div>
    <div v-if="!loading && !pagedKeywords.length" class="text-gray-500">No custom keywords found.</div>
    <ul class="w-full divide-y divide-gray-200 mb-4">
      <li v-for="kw in pagedKeywords" :key="kw.keyword + String(kw.isRegex)" class="py-2 text-black font-semibold flex items-center justify-between">
        <span>
          {{ kw.keyword }} <span v-if="kw.isRegex" class="text-xs text-blue-600">[regex]</span>
        </span>
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
