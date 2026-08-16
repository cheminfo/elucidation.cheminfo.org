import { FocusStyleManager } from '@blueprintjs/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { adoptLegacyHashAddress } from './state/view.ts';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
import './index.css';

FocusStyleManager.onlyShowFocusOnTabs();

const container = document.querySelector('#root');
if (container === null) throw new Error('Missing #root element');

// A link written while this site routed by the hash still opens: the address it
// meant is put in the bar before anything reads the address.
adoptLegacyHashAddress();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
