import ReactDOM from 'react-dom';

function MyApp() {
  return (
    <div>My app</div>
  );
}

const root = document.createElement('div');
document.body.appendChild(root);
ReactDOM.createRoot(root).render(<MyApp />);
