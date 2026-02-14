// Content script to extract HLS stream URLs from pages that use blob: URLs
// This script runs in the page context and can access window.hls or other player APIs

(function() {
  // Listen for messages from the extension
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'GET_HLS_URL') {
      let hlsUrl = null;

      // Try to find HLS.js instance
      if (window.hls && window.hls.url) {
        hlsUrl = window.hls.url;
      }

      // Try to find Dash.js instance
      if (window.dashjs && window.dashjs.MediaPlayer) {
        try {
          const player = window.dashjs.MediaPlayer().create();
          if (player.getSource) {
            hlsUrl = player.getSource();
          }
        } catch (e) {}
      }

      // Try to find m3u8 URLs in scripts or data attributes
      if (!hlsUrl) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';
          const match = content.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
          if (match) {
            hlsUrl = match[0];
            break;
          }
        }
      }

      // Send back to extension
      window.postMessage({
        type: 'HLS_URL_RESPONSE',
        url: hlsUrl
      }, '*');
    }
  });

  // Also log any m3u8 requests we can intercept
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('.m3u8')) {
      console.log('[HLS Downloader] Detected m3u8 request:', url);
      window.postMessage({
        type: 'HLS_URL_DETECTED',
        url: url
      }, '*');
    }
    return originalFetch.apply(this, args);
  };
})();
