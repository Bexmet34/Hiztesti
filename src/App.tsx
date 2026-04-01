/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Download, 
  Upload, 
  Zap, 
  RefreshCcw, 
  Globe, 
  Shield, 
  Info, 
  Menu,
  X,
  ChevronRight,
  Server,
  Wifi
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  YAxis, 
  XAxis, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { cn } from './lib/utils';

type TestState = 'idle' | 'ping' | 'download' | 'upload' | 'completed';

interface SpeedDataPoint {
  time: number;
  speed: number;
}

export default function App() {
  const [testState, setTestState] = useState<TestState>('idle');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [progress, setProgress] = useState(0);
  const [chartData, setChartData] = useState<SpeedDataPoint[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const testInterval = useRef<NodeJS.Timeout | null>(null);

  const startTest = () => {
    setTestState('ping');
    setProgress(0);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
    setJitter(0);
    setChartData([]);

    // Simulate Ping/Jitter phase
    setTimeout(() => {
      setPing(Math.floor(Math.random() * 20) + 10);
      setJitter(Math.floor(Math.random() * 5) + 1);
      setTestState('download');
      runDownloadTest();
    }, 1500);
  };

  const runDownloadTest = () => {
    let currentProgress = 0;
    const targetSpeed = Math.floor(Math.random() * 400) + 100; // 100-500 Mbps
    
    testInterval.current = setInterval(() => {
      currentProgress += 2;
      setProgress(currentProgress);
      
      const noise = (Math.random() - 0.5) * 20;
      const currentSpeed = Math.max(0, targetSpeed + noise);
      setDownloadSpeed(currentSpeed);
      
      setChartData(prev => [...prev, { time: currentProgress, speed: currentSpeed }].slice(-20));

      if (currentProgress >= 100) {
        if (testInterval.current) clearInterval(testInterval.current);
        setTestState('upload');
        setProgress(0);
        setChartData([]);
        runUploadTest();
      }
    }, 100);
  };

  const runUploadTest = () => {
    let currentProgress = 0;
    const targetSpeed = Math.floor(Math.random() * 100) + 20; // 20-120 Mbps
    
    testInterval.current = setInterval(() => {
      currentProgress += 2;
      setProgress(currentProgress);
      
      const noise = (Math.random() - 0.5) * 10;
      const currentSpeed = Math.max(0, targetSpeed + noise);
      setUploadSpeed(currentSpeed);
      
      setChartData(prev => [...prev, { time: currentProgress, speed: currentSpeed }].slice(-20));

      if (currentProgress >= 100) {
        if (testInterval.current) clearInterval(testInterval.current);
        setTestState('completed');
        setProgress(100);
      }
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (testInterval.current) clearInterval(testInterval.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center glow-blue">
            <Activity className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">SpeedPulse</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <a href="#" className="hover:text-white transition-colors">Speed Test</a>
          <a href="#" className="hover:text-white transition-colors">Network Tools</a>
          <a href="#" className="hover:text-white transition-colors">VPN Services</a>
          <a href="#" className="hover:text-white transition-colors">About</a>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden sm:flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-lg text-sm hover:bg-border transition-colors">
            <Shield className="w-4 h-4 text-accent" />
            Privacy Mode
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-surface rounded-lg"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar - Ad Placement */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="sticky top-24 space-y-6">
            <div className="w-full aspect-[1/3] bg-surface/40 border border-border rounded-2xl flex flex-col items-center justify-center p-4 text-center">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Advertisement</span>
              <div className="flex-1 w-full border border-dashed border-border rounded-lg flex items-center justify-center">
                <p className="text-xs text-gray-600 italic">Premium Ad Space<br/>160 x 600</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Test Area */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Top Ad Banner */}
          <div className="w-full h-24 bg-surface/40 border border-border rounded-2xl flex flex-col items-center justify-center p-2 text-center">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Advertisement</span>
            <div className="flex-1 w-full border border-dashed border-border rounded-lg flex items-center justify-center">
              <p className="text-xs text-gray-600 italic">Leaderboard Ad Space (728 x 90)</p>
            </div>
          </div>

          {/* Test Gauge Card */}
          <div className="glass rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-border">
              <motion.div 
                className="h-full bg-accent glow-blue"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex flex-col items-center justify-center py-12">
              <AnimatePresence mode="wait">
                {testState === 'idle' ? (
                  <motion.button
                    key="start-btn"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={startTest}
                    className="group relative w-48 h-48 rounded-full bg-accent flex flex-col items-center justify-center gap-2 text-white font-bold text-2xl glow-blue hover:scale-105 transition-transform"
                  >
                    <Zap className="w-8 h-8 fill-white" />
                    GO
                    <div className="absolute inset-[-8px] border-2 border-accent/20 rounded-full group-hover:scale-110 transition-transform" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="testing-gauge"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="text-sm font-mono text-accent uppercase tracking-[0.3em] mb-4">
                      {testState === 'ping' && 'Initializing...'}
                      {testState === 'download' && 'Downloading...'}
                      {testState === 'upload' && 'Uploading...'}
                      {testState === 'completed' && 'Test Complete'}
                    </div>
                    
                    <div className="relative flex items-baseline gap-2">
                      <span className="text-8xl md:text-9xl font-bold tracking-tighter tabular-nums">
                        {testState === 'download' ? Math.round(downloadSpeed) : 
                         testState === 'upload' ? Math.round(uploadSpeed) : 
                         testState === 'completed' ? Math.round(downloadSpeed) : '0'}
                      </span>
                      <span className="text-2xl text-gray-500 font-medium">Mbps</span>
                    </div>

                    {/* Real-time Graph */}
                    <div className="w-full h-32 mt-8 opacity-50">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <Line 
                            type="monotone" 
                            dataKey="speed" 
                            stroke="#3B82F6" 
                            strokeWidth={3} 
                            dot={false} 
                            isAnimationActive={false}
                          />
                          <YAxis hide domain={[0, 'auto']} />
                          <XAxis hide />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <MetricCard 
                label="Ping" 
                value={ping} 
                unit="ms" 
                icon={<Activity className="w-4 h-4" />} 
                active={testState === 'ping'}
              />
              <MetricCard 
                label="Jitter" 
                value={jitter} 
                unit="ms" 
                icon={<RefreshCcw className="w-4 h-4" />} 
                active={testState === 'ping'}
              />
              <MetricCard 
                label="Download" 
                value={Math.round(downloadSpeed)} 
                unit="Mbps" 
                icon={<Download className="w-4 h-4" />} 
                active={testState === 'download'}
                highlight={testState === 'completed'}
              />
              <MetricCard 
                label="Upload" 
                value={Math.round(uploadSpeed)} 
                unit="Mbps" 
                icon={<Upload className="w-4 h-4" />} 
                active={testState === 'upload'}
                highlight={testState === 'completed'}
              />
            </div>
          </div>

          {/* Network Info & Services */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                <Globe className="w-4 h-4" />
                NETWORK INFORMATION
              </div>
              <div className="space-y-3">
                <InfoRow label="ISP" value="Google Fiber" />
                <InfoRow label="Server" value="Frankfurt, DE" />
                <InfoRow label="Connection" value="Ethernet (10GbE)" />
                <div className="pt-2 flex items-center gap-2 text-[10px] text-accent font-mono uppercase bg-accent/10 px-3 py-1 rounded-full w-fit">
                  <Shield className="w-3 h-3" />
                  IP Address Hidden for Privacy
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                <Zap className="w-4 h-4" />
                QUICK SERVICES
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ServiceButton icon={<Wifi />} label="WiFi Analysis" />
                <ServiceButton icon={<Server />} label="Server Status" />
                <ServiceButton icon={<Shield />} label="DNS Leak Test" />
                <ServiceButton icon={<Activity />} label="Packet Loss" />
              </div>
            </div>
          </div>

          {/* Bottom Ad Banner */}
          <div className="w-full h-32 bg-surface/40 border border-border rounded-2xl flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Advertisement</span>
            <div className="flex-1 w-full border border-dashed border-border rounded-lg flex items-center justify-center">
              <p className="text-xs text-gray-600 italic">Rectangle Ad Space (336 x 280 or 728 x 90)</p>
            </div>
          </div>

        </div>

        {/* Right Sidebar - More Ads & Info */}
        <div className="hidden lg:block lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Top Servers</h3>
            <div className="space-y-2">
              <ServerItem name="Cloudflare" ping="8ms" />
              <ServerItem name="Google Cloud" ping="12ms" />
              <ServerItem name="AWS Frankfurt" ping="15ms" />
            </div>
          </div>

          <div className="w-full aspect-square bg-surface/40 border border-border rounded-2xl flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Advertisement</span>
            <div className="flex-1 w-full border border-dashed border-border rounded-lg flex items-center justify-center">
              <p className="text-xs text-gray-600 italic">Square Ad<br/>300 x 250</p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="glass mt-12 px-6 py-12 border-t-0">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="text-accent w-6 h-6" />
              <span className="text-xl font-bold">SpeedPulse</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              The world's most accurate and privacy-focused internet speed testing platform. Built for professionals, by professionals.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Tools</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-accent transition-colors">Speed Test</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Ping Test</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Jitter Analysis</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Network Map</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-accent transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Newsletter</h4>
            <p className="text-sm text-gray-500 mb-4">Get weekly network performance tips.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-surface border border-border rounded-lg px-4 py-2 text-sm flex-1 focus:outline-none focus:border-accent transition-colors"
              />
              <button className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-bold glow-blue">
                Join
              </button>
            </div>
          </div>
        </div>
        <div className="container mx-auto mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <p>© 2026 SpeedPulse Network. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-400">Twitter</a>
            <a href="#" className="hover:text-gray-400">LinkedIn</a>
            <a href="#" className="hover:text-gray-400">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, active, highlight }: { 
  label: string, 
  value: number, 
  unit: string, 
  icon: React.ReactNode,
  active?: boolean,
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "glass rounded-2xl p-4 flex flex-col gap-1 transition-all duration-500",
      active && "border-accent ring-1 ring-accent/50 scale-105 z-10",
      highlight && "border-success/50 bg-success/5"
    )}>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {label}
        <span className={cn(active ? "text-accent" : "text-gray-600")}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-2xl font-bold tabular-nums transition-colors",
          active ? "text-accent" : highlight ? "text-success" : "text-white"
        )}>
          {value || '0'}
        </span>
        <span className="text-[10px] text-gray-500 font-medium">{unit}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-200">{value}</span>
    </div>
  );
}

function ServiceButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-surface border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group">
      <div className="text-gray-500 group-hover:text-accent transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter text-gray-400 group-hover:text-gray-200">
        {label}
      </span>
    </button>
  );
}

function ServerItem({ name, ping }: { name: string, ping: string }) {
  return (
    <div className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer group">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-success" />
        <span className="text-gray-400 group-hover:text-white transition-colors">{name}</span>
      </div>
      <span className="font-mono text-gray-600">{ping}</span>
    </div>
  );
}
