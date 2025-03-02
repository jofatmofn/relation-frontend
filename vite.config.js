import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        open: true
    }, 
    build: {
        manifest: true,
		rollupOptions: {
			input: {
				mainjs: './src/main.js',
				mainhtml: 'index.html'
			}
		}
    }
});
