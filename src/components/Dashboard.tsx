import React from 'react';
import { WeatherData, GistdaData, ImpactSummary } from '../types';

interface DashboardProps {
    weatherData: WeatherData | null;
    gistdaData: GistdaData | null;
    gistdaError: boolean;
    gistdaErrorMessage: string;
    impactSummaries: ImpactSummary[];
    floodLevel: number;
    setFloodLevel: (level: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    weatherData,
    gistdaData,
    gistdaError,
    gistdaErrorMessage,
    impactSummaries,
    floodLevel,
    setFloodLevel
}) => {
    return (
        <div className="absolute top-4 left-4 z-50 w-96 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-700/50 transition-all duration-500 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 border-b border-gray-700 pb-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-3 rounded-xl shadow-lg">
                    <i className="fa-solid fa-water text-white text-xl"></i>
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                        Hat Yai Flood Sim
                    </h1>
                    <div className="text-xs text-green-400 flex items-center gap-2 mt-1 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Live Monitoring Active
                    </div>
                </div>
            </div>

            {/* Weather Real-time Widget */}
            <div className="mb-4 bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700/50 shadow-inner">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex justify-between">
                    <span>สภาพอากาศ (Real-time)</span>
                    <i className="fa-solid fa-tower-broadcast"></i>
                </h3>
                {weatherData ? (
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <i className={`text-3xl fa-solid ${(weatherData.current.rain > 0 || weatherData.current.showers > 0)
                                    ? 'fa-cloud-showers-heavy text-blue-400 animate-bounce'
                                    : 'fa-sun text-yellow-400 spin-slow'
                                }`}></i>
                            <div>
                                <div className="text-2xl font-bold">{weatherData.current.temperature_2m}°C</div>
                                <div className="text-xs text-gray-300">
                                    {(weatherData.current.rain > 0 || weatherData.current.showers > 0)
                                        ? `ฝนตก: ${(weatherData.current.rain + weatherData.current.showers).toFixed(1)} mm`
                                        : 'ท้องฟ้าแจ่มใส'}
                                </div>
                            </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                            Update: Just now
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-red-400">Weather data unavailable</div>
                )}
            </div>

            {/* GISTDA Impact Report */}
            <div className={`mb-6 p-4 rounded-xl border shadow-inner transition-colors ${gistdaData && gistdaData.features.length > 0
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-green-900/20 border-green-500/30'
                }`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${gistdaData && gistdaData.features.length > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                        รายงานสถานการณ์น้ำท่วม
                    </span>
                    <img src="https://gistda.or.th/assets/images/logo_gistda.png" className="h-4 opacity-80" alt="GISTDA" />
                </div>

                {gistdaData ? (
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-sm text-gray-300">พื้นที่ได้รับผลกระทบ:</span>
                            <span className="text-xl font-bold font-mono">
                                {gistdaData.features.length} <span className="text-xs font-sans text-gray-400">จุดเสี่ยง</span>
                            </span>
                        </div>

                        {/* Area Summary List */}
                        <h2 className="text-sm font-semibold text-gray-300 mt-4 mb-2">รายชื่อพื้นที่เฝ้าระวัง</h2>
                        <div className="mt-1 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {impactSummaries.length > 0 ? (
                                impactSummaries.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-xs p-2 bg-black/30 rounded border border-gray-700/50 hover:bg-black/50 transition-colors">
                                        <span className="text-gray-200">{item.areaName}</span>
                                        <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">
                                            {item.count} จุด
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-gray-500 text-center py-2">
                                    - ไม่พบข้อมูลรายละเอียดพื้นที่ -
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-gray-400 mt-2">
                            {gistdaData.features.length > 0
                                ? `⚠️ ตรวจพบพื้นที่เสี่ยงภัย โปรดระมัดระวัง`
                                : "✅ ยังไม่ตรวจพบพื้นที่น้ำท่วมขัง"}
                        </div>
                    </div>
                ) : gistdaError ? (
                    <div className="text-xs text-yellow-500 flex flex-col items-center text-center gap-1 p-2 bg-yellow-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <span>ไม่สามารถดึงข้อมูล GISTDA ได้</span>
                        </div>
                        <span className="text-gray-400 text-[10px] font-mono mt-1">{gistdaErrorMessage}</span>
                    </div>
                ) : (
                    <div className="animate-pulse h-4 bg-gray-700 rounded w-1/2"></div>
                )}
            </div>

            {/* Simulation Controls */}
            <div className="space-y-4 pt-4 border-t border-gray-700">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-300">ระดับน้ำจำลอง (Simulation)</label>
                        <span className="text-sm font-bold text-blue-400">{floodLevel} m.</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="30"
                        step="0.5"
                        value={floodLevel}
                        onChange={(e) => setFloodLevel(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${floodLevel === 0 ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        floodLevel < 2 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                            'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    <i className={`fa-solid ${floodLevel === 0 ? 'fa-check-circle' : 'fa-house-tsunami'}`}></i>
                    <span className="text-sm font-medium">
                        {floodLevel === 0 ? 'ระดับน้ำปกติ' :
                            floodLevel < 2 ? 'เฝ้าระวังน้ำล้นตลิ่ง' :
                                'วิกฤตน้ำท่วมสูง'}
                    </span>
                </div>
            </div>
        </div>
    );
};