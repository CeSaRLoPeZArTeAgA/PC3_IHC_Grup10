const cache='triagevoz-pc3-v7';
const assets=['/','/index.html','/app.js','/vui.js','/navigation.js','/styles.css','/doctor-avatar.jpg','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cache).then(store=>store.addAll(assets)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key!==cache).map(key=>caches.delete(key))
  )));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
