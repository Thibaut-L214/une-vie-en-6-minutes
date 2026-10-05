import { chapters } from './chapters.js';

const story = document.getElementById('story');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Le récit et ses commandes restent disponibles si la 3D ne charge pas.
renderStory();
import('./animation.js')
  .then(({ startAnimation }) => startAnimation([...story.children], reducedMotion))
  .catch((error) => {
    console.error(error);
    document.body.classList.add('no-webgl');
  });

function renderStory() {
  story.innerHTML = chapters
    .map(({ id, kicker, title, body }, i) => {
      const heading = i === 0 ? `<h1 id="t-${id}" tabindex="-1">${title}</h1>` : `<h2 id="t-${id}">${title}</h2>`;
      return `
        <section class="chapter chapter--${id}" aria-labelledby="t-${id}">
          <div class="card">
            ${kicker ? `<p class="kicker">${kicker}</p>` : ''}
            ${heading}
            ${body}
          </div>
        </section>`;
    })
    .join('');

  story.querySelector('[data-action="restart"]').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    story.querySelector('h1').focus({ preventScroll: true });
  });
}
