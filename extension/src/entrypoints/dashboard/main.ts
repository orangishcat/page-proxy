import {mount, unmount} from 'svelte';
import App from './App.svelte';

const suffix = ' | Page Proxy';

const applyTitleSuffix = () => {
  const currentTitle = document.title.trim();
  if (!currentTitle) {
    document.title = 'Page Proxy';
    return;
  }

  if (currentTitle === 'Page Proxy' || currentTitle.endsWith(suffix)) {
    return;
  }

  document.title = `${currentTitle}${suffix}`;
};
import '../../styles/app.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Dashboard root element not found.');
}

const app = mount(App, {target});

applyTitleSuffix();
const head = document.head;
if (head) {
  const observer = new MutationObserver(() => {
    applyTitleSuffix();
  });

  observer.observe(head, {childList: true, subtree: true});
}

export default app;
export const destroy = () => unmount(app);
