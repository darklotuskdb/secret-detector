<script setup lang="ts">
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import TabKeywords from "./TabKeywords.vue";
import TabManageKeywords from "./TabManageKeywords.vue";
import TabSeverity from "./TabSeverity.vue";
import TabBulk from "./TabBulk.vue";
import TabStats from "./TabStats.vue";
import TabAdvanced from "./TabAdvanced.vue";
import TabKeywordStats from "./TabKeywordStats.vue";
import Button from "primevue/button";
import { ref, onMounted } from "vue";
import { useSDK } from "@/plugins/sdk";

const sdk = useSDK();

const keywordUrls = {
  high: "https://raw.githubusercontent.com/darklotuskdb/secret-detector/main/keywords/high.txt",
  medium: "https://raw.githubusercontent.com/darklotuskdb/secret-detector/main/keywords/medium.txt",
  low: "https://raw.githubusercontent.com/darklotuskdb/secret-detector/main/keywords/low.txt",
};

const loading = ref(false);
const error = ref("");
const keywordCounts = ref({ high: 0, medium: 0, low: 0 });

async function fetchRemoteKeywords(url: string): Promise<string[]> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  } catch {
    return [];
  }
}

async function syncPredefinedKeywords() {
  loading.value = true;
  error.value = "";
  try {
    const [high, medium, low] = await Promise.all([
      fetchRemoteKeywords(keywordUrls.high),
      fetchRemoteKeywords(keywordUrls.medium),
      fetchRemoteKeywords(keywordUrls.low),
    ]);
    await sdk.backend.setPredefinedKeywords({ high, medium, low });
    keywordCounts.value = {
      high: high.length,
      medium: medium.length,
      low: low.length,
    };
  } catch (e) {
    error.value = "Failed to load predefined keywords.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  syncPredefinedKeywords();
});
</script>

<template>
  <div class="w-full h-full bg-white flex flex-col">
    <div class="w-full pt-6 pb-2 px-8">
      <h1 class="text-3xl font-extrabold text-black tracking-tight">Secret Detector</h1>
      <div class="flex items-center gap-4 mt-2">
        <Button label="Refresh Predefined Keywords" :loading="loading" @click="syncPredefinedKeywords" size="small" />
        <span v-if="!loading" class="text-gray-700 text-sm">
          <span>High: <b>{{ keywordCounts.high }}</b></span>
          <span class="mx-2">|</span>
          <span>Medium: <b>{{ keywordCounts.medium }}</b></span>
          <span class="mx-2">|</span>
          <span>Low: <b>{{ keywordCounts.low }}</b></span>
        </span>
        <span v-if="error" class="text-red-500 text-xs ml-2">{{ error }}</span>
      </div>
    </div>
    <div class="flex-1 w-full px-8 pb-8">
      <TabView class="w-full h-full">
        <TabPanel header="Critical Keywords">
          <TabKeywords />
        </TabPanel>
        <TabPanel header="Manage Keywords">
          <TabManageKeywords />
        </TabPanel>
        <TabPanel header="Severity Customization">
          <TabSeverity />
        </TabPanel>
        <TabPanel header="Export">
          <TabBulk />
        </TabPanel>
        <TabPanel header="Keyword Stats">
          <TabKeywordStats />
        </TabPanel>
        <TabPanel header="Advanced">
          <TabAdvanced />
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>

<style scoped>
.bg-white { background: #fff; }
.shadow-lg { box-shadow: 0 4px 24px 0 rgba(0,0,0,0.08), 0 1.5px 4px 0 rgba(0,0,0,0.04); }
</style>
