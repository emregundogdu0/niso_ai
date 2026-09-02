/**
 * background-snippet.js
 * ibelick "tailwind-css-background-snippet" Hero — vanilla JS/CSS port
 * White background + subtle grid lines + soft radial gradient center glow
 * No WebGL needed — pure CSS via injected <div> layers
 */
(function () {
  'use strict';

  function init() {
    // Remove old WebGL canvas if present
    const oldCanvas = document.getElementById('shaderCanvas');
    if (oldCanvas) oldCanvas.remove();

    // Inject CSS for the background layers
    const style = document.createElement('style');
    style.textContent = `
      #bg-snippet-root {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }

      /* Layer 1: Clean white base */
      #bg-snippet-grid {
        position: absolute;
        inset: 0;
        background-color: #ffffff;
      }

      /* Layer 2: Radial glow — indigo/violet soft spotlight in center */
      #bg-snippet-glow {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse 80% 60% at 50% 0%,
          rgba(139, 92, 246, 0.18) 0%,
          rgba(99, 102, 241, 0.12) 30%,
          transparent 70%
        );
      }

      /* Layer 3: Second subtle glow — bottom right for depth */
      #bg-snippet-glow2 {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse 55% 45% at 80% 90%,
          rgba(59, 130, 246, 0.10) 0%,
          transparent 65%
        );
      }

      /* Layer 4: Edge fade mask — keeps it clean at edges */
      #bg-snippet-mask {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse 100% 100% at 50% 50%,
          transparent 60%,
          rgba(255,255,255,0.55) 100%
        );
      }
    `;
    document.head.appendChild(style);

    // Build DOM layers
    const root  = createElement('div', 'bg-snippet-root');
    const grid  = createElement('div', 'bg-snippet-grid');
    const glow  = createElement('div', 'bg-snippet-glow');
    const glow2 = createElement('div', 'bg-snippet-glow2');
    const mask  = createElement('div', 'bg-snippet-mask');

    root.appendChild(grid);
    root.appendChild(glow);
    root.appendChild(glow2);
    root.appendChild(mask);

    // Insert before everything else in body
    document.body.insertBefore(root, document.body.firstChild);
  }

  function createElement(tag, id) {
    const el = document.createElement(tag);
    el.id = id;
    return el;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
