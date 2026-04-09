/**
 * Main Entry Point for PIXEL_HAVEN // ARCADE_OS
 */

import { GameSelector } from '../ui/selector.js';
import { NavigationHandler } from './logic/navigation.js';
import { VFX } from '../effects/vfx.js';
import { SYSTEM_CONFIG } from '../core/gameData.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log(`BOOTING: ${SYSTEM_CONFIG.hubName} // ${SYSTEM_CONFIG.osName} v${SYSTEM_CONFIG.version}`);
    window.scrollTo(0, 0);
    const selector = new GameSelector('game-grid-container');
    
    // Initialize Navigation logic (Keyboard / Swipe)
    const nav = new NavigationHandler(selector);
    
    // Global Click Listener for Audio and Fullscreen initialization
    window.addEventListener('click', () => {
        VFX.initAudio();
        
        // Force Fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`Fullscreen request failed: ${err.message}`);
            });
        }
    }, { once: true });
    
    // Optional background ambiance?
    // In a real app we'd have a persistent looping noise or beat.
});
