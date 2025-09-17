import React from 'react';
import {Provider as AppProvider, TitleBar} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <AppProvider config={{apiKey: 'old', host: 'host'}}>
      <div>
        <TitleBar title="Hello" />
      </div>
    </AppProvider>
  );
}
