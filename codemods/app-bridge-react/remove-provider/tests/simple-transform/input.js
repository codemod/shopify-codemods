import React from 'react';
import {Provider, TitleBar} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <Provider config={{apiKey: 'old', host: 'host'}}>
      <div>
        <TitleBar title="Hello" />
      </div>
    </Provider>
  );
}