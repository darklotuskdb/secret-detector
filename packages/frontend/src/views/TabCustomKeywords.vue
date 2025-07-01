<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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

onMounted(fetchKeywords);

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
</script>

<template>
  <div class="caido-card">
    <h2 class="caido-title">Custom Keywords</h2>
    <div class="caido-desc">Total custom keywords: <span class="caido-accent">{{ customKeywords.length }}</span></div>
    <div v-if="error" class="caido-error">{{ error }}</div>
    <div v-if="loading" class="caido-loading">Loading...</div>
    <div v-if="!loading && !pagedKeywords.length" class="caido-muted">No custom keywords found.</div>
    <ul class="w-full divide-y divide-gray-200 mb-4 mt-2">
      <li v-for="kw in pagedKeywords" :key="kw" class="py-2 flex items-center justify-between">
        <span class="caido-keyword">{{ kw }}</span>
        <Button label="Remove" @click="removeKeyword(kw)" class="caido-btn-danger ml-4" />
      </li>
    </ul>
    <div class="flex gap-4 items-center mt-2" v-if="totalPages > 1">
      <Button label="Previous" @click="prevPage" :disabled="page === 1" class="caido-btn-nav" />
      <span class="caido-muted">Page {{ page }} of {{ totalPages }}</span>
      <Button label="Next" @click="nextPage" :disabled="page === totalPages" class="caido-btn-nav" />
    </div>
  </div>
</template>

<style scoped>
.caido-card {
  background: var(--caido-card-bg, #181c24);
  border: 1px solid #23283a;
  border-radius: 14px;
  box-shadow: 0 2px 8px 0 #0003;
  padding: 2.2rem 1.7rem 1.7rem 1.7rem;
  margin: 2.5rem auto 0 auto;
  max-width: 480px;
  color: var(--caido-text, #f5f6fa);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.7rem;
}
.caido-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--caido-primary, #6c63ff);
  margin-bottom: 0.3rem;
  letter-spacing: 0.01em;
}
.caido-desc {
  color: #bfc9e0;
  font-size: 1.05rem;
  margin-bottom: 0.7rem;
  text-align: center;
}
.caido-accent {
  color: var(--caido-primary, #6c63ff);
  font-weight: 600;
}
.caido-keyword {
  font-weight: 600;
  color: #f5f6fa;
  font-size: 1.08rem;
  letter-spacing: 0.01em;
}
.caido-btn-danger {
  background: #e53935 !important;
  color: #fff !important;
  border-radius: 0.375rem !important;
  padding: 0.25rem 1rem !important;
  min-width: 90px;
  font-weight: 600;
}
.caido-btn-nav {
  background: #23283a !important;
  color: #bfc9e0 !important;
  border-radius: 0.375rem !important;
  font-weight: 600;
  border: 1px solid #2d3350 !important;
}
.caido-error {
  color: #ff5c5c;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.caido-loading {
  color: #bfc9e0;
  font-style: italic;
  margin-bottom: 0.5rem;
}
.caido-muted {
  color: #8a94b7;
  font-style: italic;
  font-size: 1.08rem;
}
</style>
