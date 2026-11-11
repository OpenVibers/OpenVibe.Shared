# Connection-aware player startup

`player.js` keeps the poster until a decoded frame is presented, and applies preload on enhancement: `none` for Save-Data/2g/slow-2g, `metadata` for 3g, `auto` otherwise. Set the same preload before assigning a source when creating a video dynamically: enhancement cannot undo bytes the HTML parser already requested. The Battery API is optional; its absence uses the connection policy.

Pages that attach HLS use the same policy with their existing Hls constructor and error handling:

```js
const hls = OpenVibePlayer.attachHls(video, Hls, playlist, { enableWorker: true });
// Keep the page's Hls.Events.ERROR fallback and destroy hls on navigation.
```

Native HLS uses the video's preload; hls.js loads the manifest but defers segments until play on constrained connections. The first level is 0 (hls.js orders the ladder by bitrate); automatic ABR then chooses subsequent levels. No rendition is invented if the source only has one. Forward/back buffers are 60/30 seconds normally, 30/15 on 3g, 30/0 on 2g or Save-Data, and 15/0 on an unplugged battery at 20% or lower. The hard forward limits are 120/60/30 seconds. Battery and connection changes update the attachment; destroy removes listeners.

Cards opt in using a **public**, unsigned VOD HLS source:

```html
<a href="/watch?v=…" data-ov-player-hls="https://openvibe.media/o/…/master.m3u8">Watch</a>
```

Call `OpenVibePlayer.warmCards(container)` for cards added later. Hover or keyboard focus for 120 ms warms the lowest playlist, its init and first media segment into HTTP cache. It stops on leave/blur, avoids live, encrypted, signed and byte-range playlists, and makes no requests on Save-Data/2g/3g or low battery. Each card is capped at 2 MiB and each document at 20 starts per minute. Oversized first segments are cancelled; warming is best effort, never a prerequisite for playback. HTTP cache reuse depends on the source's cache/CORS headers and browser partitioning.

These helpers do not replace a consumer's existing HLS constructor automatically. Consumer adoption and release pins are necessary to get the buffer policy. Next for the design: use the source attribute on existing cards; keep their appearance and controls with the main session.
