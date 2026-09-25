import { defineConfig } from 'vitest/config';

// Saf fonksiyon testleri: Miniflare/workerd gerekmez, Node ortamı yeterli.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
