import React from 'react';

interface LoadingOverlayProps {
    loadingStep: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loadingStep }) => {
    return (
        <div className="loading-overlay">
            <div className="spinner"></div>
            <h2 className="text-2xl font-bold">กำลังประมวลผลข้อมูล GISTDA & Weather...</h2>
            <div className="flex flex-col gap-1 text-sm text-gray-400">
                <span>📡 Weather API: {loadingStep >= 1 ? 'OK' : '...'}</span>
                <span>🛰️ GISTDA Satellite: {loadingStep >= 2 ? 'OK' : '...'}</span>
                <span>🏢 3D Buildings: {loadingStep >= 3 ? 'OK' : '...'}</span>
            </div>
        </div>
    );
};