/**
 * Game Selector UI System for ARCADE_OS
 * Handles rendering the grid and managing selection state.
 */

import { GAMES, SYSTEM_CONFIG } from '../core/gameData.js';
import { VFX } from '../effects/vfx.js';

export class GameSelector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentIndex = 0;
    this.games = GAMES;
    this.tiles = [];
    this.isLaunching = false;
    
    // Recovery of last played game
    const savedIndex = localStorage.getItem(SYSTEM_CONFIG.lastPlayedKey);
    if (savedIndex !== null) {
      this.currentIndex = parseInt(savedIndex, 10);
      if (isNaN(this.currentIndex) || this.currentIndex >= this.games.length) {
        this.currentIndex = 0;
      }
    }
    
    this.init();
  }

  init() {
    this.render();
    this.updateSelection();
  }

  render() {
    this.container.innerHTML = '';
    this.tiles = this.games.map((game, index) => {
      const tile = document.createElement('div');
      tile.className = 'game-tile';
      tile.dataset.index = index;
      tile.style.setProperty('--active-color', game.color);
      
      const icon = document.createElement('div');
      icon.className = 'tile-icon';
      icon.textContent = this.getGenreIcon(game.genre);
      
      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = game.name;
      
      tile.appendChild(icon);
      tile.appendChild(label);
      
      // Click interaction
      tile.addEventListener('click', (e) => {
        if (this.currentIndex === index) {
          this.launch(index);
        } else {
          this.setSelection(index);
        }
      });

      // Hover interaction for desktop
      tile.addEventListener('mouseenter', () => {
        if (!this.isLaunching) {
          this.setSelection(index, false); // Don't trigger sound on hover for desktop (might be too much)
        }
      });
      
      this.container.appendChild(tile);
      return tile;
    });
  }

  /**
   * Return a character representing the genre
   */
  getGenreIcon(genre) {
    switch (genre) {
      case 'ACTION': return '⚔️';
      case 'RUNNER': return '🏃';
      case 'RHYTHM': return '🎵';
      case 'RACING': return '🏎️';
      case 'PUZZLE': return '🧩';
      case 'SHMUP': return '🛸';
      case 'BRAWLER': return '💥';
      case 'PLATFORMER': return '🧱';
      case 'STRATEGY': return '♟️';
      default: return '🎮';
    }
  }

  /**
   * Set selection to a specific index
   */
  setSelection(index, triggerSound = true) {
    if (this.currentIndex === index || this.isLaunching) return;
    
    this.currentIndex = index;
    this.updateSelection();
    
    if (triggerSound) {
      VFX.playSound('hop');
      VFX.vibrate(15);
    }
    
    // Save state
    localStorage.setItem(SYSTEM_CONFIG.lastPlayedKey, index);
  }

  /**
   * Navigation method for logic system
   */
  move(direction) {
    if (this.isLaunching) return;

    const itemsPerRow = this.getItemsPerRow();
    let nextIndex = this.currentIndex;

    switch (direction) {
      case 'left':
        nextIndex = (this.currentIndex - 1 + this.games.length) % this.games.length;
        break;
      case 'right':
        nextIndex = (this.currentIndex + 1) % this.games.length;
        break;
      case 'up':
        nextIndex = (this.currentIndex - itemsPerRow + this.games.length) % this.games.length;
        break;
      case 'down':
        nextIndex = (this.currentIndex + itemsPerRow) % this.games.length;
        break;
    }
    
    this.setSelection(nextIndex);
  }

  /**
   * Determine grid dimensions for directional navigation wrap
   */
  getItemsPerRow() {
    const width = window.innerWidth;
    if (width > 1024) return 4;
    if (width > 768) return 3;
    return 2;
  }

  /**
   * Update UI elements based on current selection
   */
  updateSelection() {
    this.tiles.forEach((tile, index) => {
      tile.classList.toggle('active', index === this.currentIndex);
    });

    // Update Detail Panel
    const currentGame = this.games[this.currentIndex];
    const detailName = document.querySelector('.details-name');
    const detailDesc = document.querySelector('.details-desc');
    
    if (detailName && detailDesc) {
      detailName.textContent = currentGame.name;
      detailName.style.color = currentGame.color;
      const genreStr = currentGame.genre ? `[ ${currentGame.genre} ] // ` : "";
      const descStr = currentGame.description || "NO DATA AVAILABLE";
      detailDesc.textContent = `${genreStr}${descStr}`;
      
      // Glitch detail panel text slightly on change
      detailName.style.transform = `translateX(${Math.random() * 4 - 2}px)`;
      setTimeout(() => detailName.style.transform = 'none', 50);
    }
  }

  /**
   * Launch selected game with transition
   */
  launch(index = this.currentIndex) {
    if (this.isLaunching) return;
    this.isLaunching = true;
    
    const game = this.games[index];
    VFX.playSound('confirm');
    VFX.triggerGlitchFlash();
    VFX.vibrate([40, 30, 40]);
    
    console.log(`Lauching ${game.name}...`);
    
    // Post-animation redirection
    setTimeout(() => {
      console.log(`Redirecting to: ${game.path}`);
      window.location.href = game.path;
    }, 800);
  }
}
