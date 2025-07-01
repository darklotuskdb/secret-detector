<template>
  <div class="w-full max-w-5xl bg-white rounded-xl shadow-lg p-8 flex flex-row items-start gap-10">
    <!-- Left: Severity Stats as filter buttons -->
    <div class="flex-1 min-w-[320px]">
      <h2 class="text-2xl font-extrabold text-[#1976d2] mb-4 tracking-tight">Keyword Stats</h2>
      <div class="flex gap-4 mb-6 w-full justify-center">
        <Button label="Refresh" @click="refreshStats" class="font-bold" style="background:#1976d2;color:#fff;min-width:120px;box-shadow:0 2px 8px #1976d233;" />
      </div>
      <div class="w-full flex flex-wrap gap-3 mb-6 justify-center">
        <Button label="All" :outlined="!selectedSeverity" :class="selectedSeverity ? '' : 'bg-[#1976d2] text-white'" @click="selectSeverity('')" />
        <Button v-for="sev in severities" :key="sev" :label="sev.toUpperCase() + ' (' + (stats[sev] || 0) + ')'" :outlined="selectedSeverity !== sev" :class="selectedSeverity === sev ? 'bg-[#1976d2] text-white' : ''" @click="selectSeverity(sev)" />
      </div>
    </div>
    <!-- Right: Most Reflected Keywords -->
    <div class="flex-1.5 min-w-[380px] max-w-lg bg-gradient-to-br from-white to-gray-100 rounded-xl p-6 shadow border border-gray-200">
      <div class="text-center font-semibold mb-2 text-gray-700 text-lg tracking-wide">Most Reflected Keywords</div>
      <div class="text-center text-gray-500 mb-4">Total: <span class="font-bold">{{ filteredKeywords.length }}</span></div>
      <div v-if="loading" class="text-gray-700 mb-2">Loading...</div>
      <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
      <ul class="w-full divide-y divide-gray-200 mb-4">
        <li v-for="kw in pagedKeywords" :key="kw.keyword" class="py-3 flex items-center bg-white hover:bg-gray-50 rounded-lg mb-2 shadow-sm transition">
          <span class="text-gray-800 font-semibold text-base">{{ kw.keyword }}</span>
        </li>
      </ul>
      <div class="flex gap-4 items-center mt-2 justify-center" v-if="filteredKeywords.length > pageSize">
        <Button label="Prev" @click="prevPage" :disabled="page === 1" />
        <span class="text-gray-600">Page {{ page }} / {{ totalPages }}</span>
        <Button label="Next" @click="nextPage" :disabled="page === totalPages" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Button from "primevue/button";
import { useSDK } from "../plugins/sdk";

const sdk = useSDK();

const severities = ["critical", "high", "medium", "low"];
const stats = ref<Record<string, number>>({});
const keywordStats = ref<{ keyword: string; count: number; severity?: string }[]>([]);
const loading = ref(false);
const error = ref("");
const page = ref(1);
const pageSize = 5;
const selectedSeverity = ref("");

const filteredKeywords = computed(() => {
  if (!selectedSeverity.value) return keywordStats.value;
  return keywordStats.value.filter(k => k.severity === selectedSeverity.value);
});
const totalKeywords = computed(() => filteredKeywords.value.length);
const totalPages = computed(() => Math.ceil(totalKeywords.value / pageSize));
const pagedKeywords = computed(() => filteredKeywords.value.slice((page.value - 1) * pageSize, page.value * pageSize));

function nextPage() { if (page.value < totalPages.value) page.value++; }
function prevPage() { if (page.value > 1) page.value--; }
function selectSeverity(sev: string) {
  if (selectedSeverity.value === sev) {
    selectedSeverity.value = ""; // Deselect if already selected
  } else {
    selectedSeverity.value = sev;
  }
  page.value = 1;
}

async function fetchStats() {
  loading.value = true;
  error.value = "";
  try {
    const res = await sdk.backend.getKeywordStats();
    stats.value = res.stats;
    // If backend does not provide severity per keyword, infer it from findings
    if (res.keywords.length && !('severity' in res.keywords[0])) {
      // fallback: show all
      keywordStats.value = res.keywords;
    } else {
      keywordStats.value = res.keywords;
    }
  } catch (e) {
    error.value = "Failed to load stats.";
  }
  loading.value = false;
}

function refreshStats() {
  page.value = 1;
  fetchStats();
}

onMounted(fetchStats);
</script>

<style scoped>
.max-w-lg { max-width: 32rem; }
.min-w-\[320px\] { min-width: 320px; }
.min-w-\[380px\] { min-width: 380px; }
.flex-1\.5 { flex: 1.5; }
</style>
