import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: 'Nexus Design System',
  brandUrl: 'https://nexus-ui.dev',
  brandImage: undefined,
  brandTarget: '_self',

  // UI
  appBg: '#ffffff',
  appContentBg: '#ffffff',
  appBorderColor: '#e5e7eb',
  appBorderRadius: 6,

  // Typography
  fontBase: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontCode: '"JetBrains Mono", "Fira Code", Consolas, monospace',

  // Text colors
  textColor: '#1f2937',
  textInverseColor: '#ffffff',

  // Toolbar default and active colors
  barTextColor: '#6b7280',
  barSelectedColor: '#3b82f6',
  barBg: '#f9fafb',

  // Form colors
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputTextColor: '#1f2937',
  inputBorderRadius: 6,

  // Brand colors
  colorPrimary: '#3b82f6',
  colorSecondary: '#64748b',
});

addons.setConfig({
  theme,
  panelPosition: 'bottom',
  selectedPanel: 'controls',
  sidebar: {
    showRoots: false,
    collapsedRoots: ['other'],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});
