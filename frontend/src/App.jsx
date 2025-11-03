import React from 'react';
import Register from './components/Register';
import './App.css'; // 保留一些基础样式

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>多人在线协作编辑软件</h1>
      </header>
      <main>
        <Register />
      </main>
    </div>
  );
}

export default App;