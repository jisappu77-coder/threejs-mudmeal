import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{target:'es2022',rollupOptions:{input:['index.html','review.html','crowd.html','real-map.html']}},server:{host:'0.0.0.0',allowedHosts:['terminal.local']}});
