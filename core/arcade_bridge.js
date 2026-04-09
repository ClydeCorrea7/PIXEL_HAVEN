/**
 * PIXEL_HAVEN // ARCADE_BRIDGE
 * Global logic for all Pixel Haven games.
 */

(function() {
    function requestFullScreen() {
        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;

        if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            if (requestFullScreen) {
                requestFullScreen.call(docEl).catch(err => {
                    console.warn(`Fullscreen request failed: ${err.message}`);
                });
            }
        }
    }

    // Attempt on first user interaction within the game
    window.addEventListener('mousedown', requestFullScreen, { once: true });
    window.addEventListener('touchstart', requestFullScreen, { once: true });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
            requestFullScreen();
        }
    }, { once: true });

    console.log("ARCADE_BRIDGE: Fullscreen hook active.");
})();
