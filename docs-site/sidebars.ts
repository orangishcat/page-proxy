import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'pp Library',
      items: ['pp/overview', 'pp/pq-query', 'pp/pv-event', 'pp/ps-style'],
    },
  ],
};

export default sidebars;
