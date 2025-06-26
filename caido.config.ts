import { defineConfig } from '@caido-community/dev';

export default defineConfig({
  id: "secret-detector",
  name: "Secret Detector",
  description: "Detects hardcoded secrets from proxied HTTP traffic like API keys, sensitive tokens, passwords, etc.",
  version: "1.0.0",
  author: {
    name: "DarkLotusKDB",
    email: "darklotuskdb@gmail.com", // optional: replace or remove
    url: "https://www.linkedin.com/in/kamaldeepbhati/", // optional
  },
  plugins: [
    {
      kind: "backend",
      id: "backend",
      root: "packages/backend",
    },
  ]
});