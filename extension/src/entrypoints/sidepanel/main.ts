import {mount, unmount} from 'svelte';
import App from './App.svelte';
import '../../styles/app.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Side panel root element not found.');
}

const app = mount(App, {target});

export default app;
export const destroy = () => unmount(app);
