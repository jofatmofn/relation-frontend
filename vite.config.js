import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        open: true
    }, 
    build: {
        manifest: true,
		rollupOptions: {
			input: {
				mainjs: './src/js/reltree.js',
				mainhtml: 'index.html'
			}
		},
		minify: false,	// minify and terserOptions are just for debug
		terserOptions: {
			compress: false,
			mangle: false,
		}
    }
});
