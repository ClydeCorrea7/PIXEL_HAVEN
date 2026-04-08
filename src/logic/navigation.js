/**
 * Input Management for ARCADE_OS
 * Handles Keyboard and Touch interactions.
 */

import { VFX } from '../../effects/vfx.js';

export class NavigationHandler {
  constructor(gameSelector) {
    this.selector = gameSelector;
    this.touchStart = { x: 0, y: 0 };
    this.touchEnd = { x: 0, y: 0 };
    this.swipeThreshold = 50; // Minimum pixels to trigger swipe
    
    this.init();
  }

  init() {
    this.bindKeyboard();
    this.bindTouch();
  }

  /**
   * Keyboard Arrow Mapping
   */
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ensure audio context is started on first interaction
      VFX.initAudio();

      switch (e.key) {
        case 'ArrowLeft':
          this.selector.move('left');
          break;
        case 'ArrowRight':
          this.selector.move('right');
          break;
        case 'ArrowUp':
          this.selector.move('up');
          break;
        case 'ArrowDown':
          this.selector.move('down');
          break;
        case 'Enter':
        case ' ':
          this.selector.launch();
          break;
      }
    });
  }

  /**
   * Swipe Detection logic
   */
  bindTouch() {
    window.addEventListener('touchstart', (e) => {
      VFX.initAudio();
      this.touchStart.x = e.changedTouches[0].screenX;
      this.touchStart.y = e.changedTouches[0].screenY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      this.touchEnd.x = e.changedTouches[0].screenX;
      this.touchEnd.y = e.changedTouches[0].screenY;
      this.handleSwipe();
    }, { passive: true });
  }

  handleSwipe() {
    const diffX = this.touchEnd.x - this.touchStart.x;
    const diffY = this.touchEnd.y - this.touchStart.y;
    
    // Determine if horizontal or vertical swipe was more prominent
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal
      if (Math.abs(diffX) > this.swipeThreshold) {
        if (diffX > 0) {
          this.selector.move('right');
        } else {
          this.selector.move('left');
        }
      }
    } else {
      // Vertical
      if (Math.abs(diffY) > this.swipeThreshold) {
        if (diffY > 0) {
          this.selector.move('down');
        } else {
          this.selector.move('up');
        }
      }
    }
  }
}
