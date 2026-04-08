/**
 * Visual Effects for ARCADE_OS
 */

export class VFXManager {
  constructor() {
    this.flashElement = document.createElement('div');
    this.flashElement.className = 'glitch-flash';
    document.body.appendChild(this.flashElement);
    
    this.audioCtx = null;
    this.sounds = {};
  }

  /**
   * Play the glitch flash animation
   */
  triggerGlitchFlash() {
    this.flashElement.classList.remove('active');
    void this.flashElement.offsetWidth; // Trigger reflow
    this.flashElement.classList.add('active');
    
    // Slight screen shake
    const container = document.querySelector('.arcade-container');
    if (container) {
      container.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
      setTimeout(() => {
        container.style.transform = 'none';
      }, 100);
    }
  }

  /**
   * Initialize Web Audio API for internal sounds
   */
  async initAudio() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Play a synthesized 8-bit sound
   * @param {string} type - 'hop', 'confirm'
   */
  playSound(type) {
    if (!this.audioCtx) return;
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    const now = this.audioCtx.currentTime;
    
    if (type === 'hop') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start();
      osc.stop(now + 0.1);
    } else if (type === 'confirm') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(800, now + 0.05);
      osc.frequency.setValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start();
      osc.stop(now + 0.3);
    }
  }

  /**
   * Trigger haptic feedback if available
   */
  vibrate(duration = [20]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
}

export const VFX = new VFXManager();
