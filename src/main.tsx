import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// *** บรรทัดนี้สำคัญมาก! ***
import './styles.css'; // หรือ './index.css' แล้วแต่ว่าคุณตั้งชื่อไฟล์ว่าอะไร

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);