import { browser } from '$app/environment';
import { writable } from 'svelte/store';

function store() {
  const dark = writable(false);

  if (browser) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    dark.set(mq.matches);
    mq.addEventListener('change', (e) => dark.set(e.matches));
  }
  return dark;
}

export const dark = store();
