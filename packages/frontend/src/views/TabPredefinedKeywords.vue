<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useSDK } from "@/plugins/sdk";

const sdk = useSDK();
const loading = ref(false);
const error = ref("");
const keywords = ref<string[]>([]);

const fetchPredefinedKeywords = async () => {
  loading.value = true;
  error.value = "";
  try {
    const result = await sdk.backend.getPredefinedKeywords();
    keywords.value = Array.isArray(result) ? result : [];
  } catch (e) {
    error.value = "Failed to load predefined keywords.";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchPredefinedKeywords);
</script>

<template>
  <div class="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-4">Predefined Keywords</h2>
    <button
      class="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      @click="fetchPredefinedKeywords"
      :disabled="loading"
    >
      Refresh Predefined Keywords
    </button>
    <div v-if="error" class="text-red-500 mb-2">{{ error }}</div>
    <div v-if="loading" class="text-gray-700 mb-2">Loading...</div>
    <div v-if="!loading">
      <div class="w-full mb-6">
        <h3 class="font-bold text-lg text-gray-700 mb-2">All Predefined Keywords ({{ keywords.length }})</h3>
        <ul class="list-disc ml-6 text-black text-sm">
          <li v-for="kw in keywords" :key="kw">{{ kw }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>
