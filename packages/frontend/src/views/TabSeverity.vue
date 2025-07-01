<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useSDK } from "@/plugins/sdk";

const sdk = useSDK();
const severities = ["critical", "high", "medium", "low"];
const severityToggles = ref<Record<string, boolean>>({
  high: true,
  medium: true,
  low: true,
  critical: true,
});

// Persist to localStorage for user experience
const STORAGE_KEY = "secret-detector-severity-toggles";

const syncToBackend = async () => {
  await sdk.backend.setSeverityToggles(severityToggles.value);
};

onMounted(async () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      for (const s of severities) {
        if (typeof parsed[s] === "boolean") severityToggles.value[s] = parsed[s];
      }
    } catch {}
  }
  // Load from backend if available
  try {
    const backendToggles = await sdk.backend.getSeverityToggles();
    for (const s of severities) {
      if (typeof backendToggles[s] === "boolean") severityToggles.value[s] = backendToggles[s];
    }
  } catch {}
});

watch(severityToggles, (val) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  syncToBackend();
}, { deep: true });

// Expose for backend use (window, or use a global store in real app)
window.__SECRET_DETECTOR_SEVERITY_TOGGLES__ = severityToggles;
</script>

<template>
  <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
    <h2 class="text-xl font-bold text-black mb-4">Severity Customization</h2>
    <p class="text-gray-700 mb-4 text-center">Toggle which severity levels should generate findings. All are enabled by default.</p>
    <div class="w-full flex flex-col gap-4">
      <div v-for="sev in severities" :key="sev" class="flex items-center justify-between">
        <span class="capitalize font-semibold text-black">{{ sev }}</span>
        <input type="checkbox" v-model="severityToggles[sev]" class="form-checkbox h-5 w-5 text-blue-600" />
      </div>
    </div>
  </div>
</template>
