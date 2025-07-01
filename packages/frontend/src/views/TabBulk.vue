<template>
  <div class="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-2xl font-extrabold text-[#1976d2] mb-4 tracking-tight">Export</h2>
    <div class="flex gap-4 mb-6 w-full justify-center">
      <Button label="Download Custom Keywords (.txt)" @click="downloadKeywords" class="font-bold" style="background:#1976d2;color:#fff;min-width:200px;box-shadow:0 2px 8px #1976d233;" />
      <Button label="Export All Findings (.json)" @click="downloadAllFindings" class="font-bold" style="background:#111;color:#fff;min-width:200px;box-shadow:0 2px 8px #1112;" />
      <Button label="Refresh" @click="refreshAll" class="font-bold" style="background:#1976d2;color:#fff;min-width:120px;box-shadow:0 2px 8px #1976d233;" />
    </div>
    <div class="w-full text-center font-semibold mb-4 text-[#1976d2]">Total domains with findings: <span class="font-extrabold">{{ totalDomains }}</span></div>
    <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
    <div v-if="loading" class="text-gray-700 mb-2">Loading...</div>
    <div v-if="!loading && !pagedDomains.length" class="text-gray-500">No findings found.</div>
    <ul class="w-full divide-y divide-gray-200 mb-4">
      <li v-for="domain in pagedDomains" :key="domain" class="py-3 flex items-center justify-between bg-[#f5f8fd] rounded-lg mb-2 shadow-sm">
        <span class="text-[#1976d2] font-bold text-lg">{{ domain }}</span>
        <span class="text-gray-700 font-semibold">({{ domainMap[domain]?.length || 0 }} results)</span>
        <Button label="Export Results" @click="downloadDomainFindings(domain)" class="ml-4 font-bold" style="background:#1976d2;color:#fff;border-radius:0.375rem;padding:0.25rem 1rem;min-width:120px;box-shadow:0 2px 8px #1976d233;" />
      </li>
    </ul>
    <div class="flex gap-4 items-center mt-2" v-if="totalDomains > pageSize">
      <Button label="Previous" @click="prevPage" :disabled="page === 1" style="background:#1976d2;color:#fff;" />
      <span class="font-semibold text-[#1976d2]">Page {{ page }} of {{ Math.ceil(totalDomains / pageSize) }}</span>
      <Button label="Next" @click="nextPage" :disabled="page === Math.ceil(totalDomains / pageSize)" style="background:#1976d2;color:#fff;" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Button from "primevue/button";
import { useSDK } from "@/plugins/sdk";

const sdk = useSDK();
const customKeywords = ref<string[]>([]);
const findings = ref<any[]>([]);
const domainMap = ref<Record<string, any>>({});
const page = ref(1);
const pageSize = 10;

const loading = ref(false);
const error = ref("");

const fetchCustomKeywords = async () => {
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    customKeywords.value = Array.isArray(stored) ? stored : [];
  } catch (e) {
    error.value = "Failed to load custom keywords.";
  }
};

const fetchFindings = async () => {
  loading.value = true;
  try {
    const all = await sdk.backend.getAllFindings();
    findings.value = Array.isArray(all) ? all : [];
    // Group by domain
    const map: Record<string, any[]> = {};
    for (const f of findings.value) {
      try {
        const url = new URL(f.url || f.request?.url);
        const domain = url.hostname;
        if (!map[domain]) map[domain] = [];
        map[domain].push(f);
      } catch {}
    }
    domainMap.value = map;
  } catch (e) {
    error.value = "Failed to load findings.";
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  await fetchCustomKeywords();
  await fetchFindings();
};

onMounted(() => {
  refreshAll();
});

const domainList = computed(() => Object.keys(domainMap.value));
const totalDomains = computed(() => domainList.value.length);
const pagedDomains = computed(() => {
  const start = (page.value - 1) * pageSize;
  return domainList.value.slice(start, start + pageSize);
});
const nextPage = () => { if (page.value < Math.ceil(domainList.value.length / pageSize)) page.value++; };
const prevPage = () => { if (page.value > 1) page.value--; };

async function downloadKeywords() {
  try {
    const stored = await sdk.backend.getCriticalKeywords();
    const keywords = Array.isArray(stored) ? stored : [];
    if (keywords.length === 0) {
      error.value = "No custom keywords to export.";
      return;
    }
    const blob = new Blob([keywords.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_keywords.txt";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.value = "Failed to export custom keywords.";
  }
}

function downloadAllFindings() {
  const blob = new Blob([JSON.stringify(findings.value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "all_findings.json";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDomainFindings(domain: string) {
  const blob = new Blob([JSON.stringify(domainMap.value[domain], null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${domain}_findings.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
