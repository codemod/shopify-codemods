import ReactDOM from 'react-dom';
import {Provider} from '@shopify/app-bridge-react';

function MyApp() {
  return (
    <Provider config={config}>
      <div>My app</div>
    </Provider>
  );
}

const root = document.createElement('div');
document.body.appendChild(root);
ReactDOM.createRoot(root).render(<MyApp />);