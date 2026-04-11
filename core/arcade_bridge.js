/**
 * PIXEL_HAVEN // ARCADE_BRIDGE
 * Global logic for all Pixel Haven games.
 * Includes MOBILE-SAFE Universal Scale-to-Fit System.
 */

(function() {
    /**
     * UNIVERSAL SCALE-TO-FIT SYSTEM (Mobile Optimized)
     * Maintains 1280x720 aspect ratio via transform: scale()
     */
    function scaleGame() {
        const game = document.getElementById("gameContainer");
        if (!game) return;

        const baseWidth = 1280;
        const baseHeight = 720;

        // Use visualViewport if available (fixes mobile browser UI issues like address bar)
        const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

        const scaleX = viewportWidth / baseWidth;
        const scaleY = viewportHeight / baseHeight;

        // Maintain aspect ratio (letterboxing)
        const scale = Math.min(scaleX, scaleY);

        game.style.transform = `scale(${scale})`;
    }

    function requestFullScreen() {
        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;

        if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            if (requestFS) {
                requestFS.call(docEl).catch(err => {
                    console.warn(`Fullscreen request failed: ${err.message}`);
                });
            }
        }
    }

    // Initialization
    window.addEventListener("load", scaleGame);
    window.addEventListener("resize", scaleGame);

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", scaleGame);
    }

    window.addEventListener("orientationchange", () => {
        setTimeout(scaleGame, 100);
    });

    // Attempt on first user interaction
    const interactionEvents = ['mousedown', 'touchstart', 'keydown'];
    interactionEvents.forEach(evt => {
        window.addEventListener(evt, () => {
            requestFullScreen();
            scaleGame();
        }, { once: true });
    });

    // Initial scale call
    scaleGame();

    console.log("ARCADE_BRIDGE: Mobile-Safe Scaling System active.");
})();
