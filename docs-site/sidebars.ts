import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'release-notes',
    'purpose',
    {
      type: 'category',
      label: 'Basics',
      collapsed: false,
      items: ['extension-usage', 'your-first-script', 'auto-metadata', 'permissions'],
    },
    {
      type: 'category',
      label: 'pp Library',
      collapsed: false,
      items: ['pp/overview', 'pp/pa-api', 'pp/pn-network', 'pp/pt-storage', 'pp/pq-query', 'pp/pv-event', 'pp/ps-style'],
    },
  ],
};

export default sidebars;
