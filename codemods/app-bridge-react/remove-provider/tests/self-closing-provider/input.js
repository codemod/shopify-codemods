import React from 'react';
import {Provider} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <div>
      <Provider config={{apiKey: 'test'}} />
      <p>Some content</p>
    </div>
  );
}
