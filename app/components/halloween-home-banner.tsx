'use client';

import { useSyncExternalStore } from 'react';
import { applyTheme } from './theme-controller';
import type { Theme } from '../../lib/settings-policy';

function subscribe(callback: () => void) {
  if (typeof document === 'undefined') return () => undefined;
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preference'] });
  return () => observer.disconnect();
}

function getSnapshot() {
  if (typeof document === 'undefined') return 'system';
  const pref = document.documentElement.dataset.preference || 'system';
  const theme = document.documentElement.dataset.theme || 'dark';
  return pref === 'halloween' || theme === 'halloween' ? 'halloween' : pref;
}

function getServerSnapshot() {
  return 'system';
}

export default function HalloweenHomeBanner() {
  const currentTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function selectTheme(theme: Theme) {
    applyTheme(theme);
  }

  const isHalloween = currentTheme === 'halloween';

  return (
    <section className={`halloweenHomeSection shell ${isHalloween ? 'isHalloweenActive' : ''}`} aria-label="Halloween Season Showcase">
      <div className="halloweenCard">
        <div className="halloweenDecor" aria-hidden="true">
          <span className="spookyFloatingBat bat1">🦇</span>
          <span className="spookyFloatingBat bat2">🦇</span>
          <span className="spookyPumpkinIcon">🎃</span>
        </div>

        <div className="halloweenContent">
          <div className="halloweenBadge">
            <span className="spookyFlame">🔥</span>
            <span>SPOOKY SEASON SPECIAL</span>
          </div>
          <h2 className="halloweenTitle">
            {isHalloween ? 'Welcome to the Dark Abyss 👻' : 'Experience the Spooky Halloween Theme'}
          </h2>
          <p className="halloweenDescription">
            Immerse your feed in deep violet shadows, pumpkin neon glows, and custom eerie accents crafted for virtual photographers & gamers.
          </p>

          <div className="halloweenThemeControls">
            <button
              type="button"
              className={`halloweenToggleBtn ${isHalloween ? 'active' : ''}`}
              onClick={() => selectTheme(isHalloween ? 'dark' : 'halloween')}
            >
              {isHalloween ? '🎃 Spooky Theme Active (Click to Revert)' : '⚡ Activate Halloween Mode 🎃'}
            </button>

            <div className="quickThemePills" aria-label="Quick theme selection">
              <span className="quickThemeLabel">Theme:</span>
              <button
                type="button"
                className={`themePill ${currentTheme === 'halloween' ? 'selected' : ''}`}
                onClick={() => selectTheme('halloween')}
                title="Halloween theme"
              >
                🎃 Spooky
              </button>
              <button
                type="button"
                className={`themePill ${currentTheme === 'dark' ? 'selected' : ''}`}
                onClick={() => selectTheme('dark')}
                title="Dark theme"
              >
                🌙 Dark
              </button>
              <button
                type="button"
                className={`themePill ${currentTheme === 'light' ? 'selected' : ''}`}
                onClick={() => selectTheme('light')}
                title="Light theme"
              >
                ☀️ Light
              </button>
              <button
                type="button"
                className={`themePill ${currentTheme === 'system' ? 'selected' : ''}`}
                onClick={() => selectTheme('system')}
                title="Follow system theme"
              >
                ⚙️ System
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
