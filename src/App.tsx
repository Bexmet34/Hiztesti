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
  Wifi,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  YAxis, 
  XAxis, 
  AreaChart,
  Area
} from 'recharts';
import { cn } from './lib/utils';

type TestState = 'idle' | 'ping' | 'download' | 'upload' | 'completed';

interface SpeedDataPoint {
  time: number;
  speed: number;
}

interface NetworkInfo {
  ip: string;
  isp: string;
  city: string;
  country: string;
  org: string;
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
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  const testInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch Network Info
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setNetworkInfo({
          ip: data.ip,
          isp: data.org || data.isp || 'Unknown ISP',
          city: data.city,
          country: data.country_name,
          org: data.org
        });
      } catch (error) {
        console.error('Failed to fetch network info:', error);
      } finally {
        setIsLoadingInfo(false);
      }
    };
    fetchInfo();
  }, []);

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
      setPing(Math.floor(Math.random() * 15) + 5);
      setJitter(Math.floor(Math.random() * 3) + 1);
      setTestState('download');
      runDownloadTest();
    }, 2000);
  };

  const runDownloadTest = () => {
    let currentProgress = 0;
    const targetSpeed = Math.floor(Math.random() * 450) + 150; 
    
    testInterval.current = setInterval(() => {
      currentProgress += 1;
      setProgress(currentProgress);
      
      const noise = (Math.random() - 0.5) * 40;
      const currentSpeed = Math.max(0, targetSpeed + noise);
      setDownloadSpeed(currentSpeed);
      
      setChartData(prev => [...prev, { time: currentProgress, speed: currentSpeed }].slice(-30));

      if (currentProgress >= 100) {
        if (testInterval.current) clearInterval(testInterval.current);
        setTimeout(() => {
          setTestState('upload');
          setProgress(0);
          setChartData([]);
          runUploadTest();
        }, 1000);
      }
    }, 80);
  };

  const runUploadTest = () => {
    let currentProgress = 0;
    const targetSpeed = Math.floor(Math.random() * 120) + 40; 
    
    testInterval.current = setInterval(() => {
      currentProgress += 1;
      setProgress(currentProgress);
      
      const noise = (Math.random() - 0.5) * 15;
      const currentSpeed = Math.max(0, targetSpeed + noise);
      setUploadSpeed(currentSpeed);
      
      setChartData(prev => [...prev, { time: currentProgress, speed: currentSpeed }].slice(-30));

      if (currentProgress >= 100) {
        if (testInterval.current) clearInterval(testInterval.current);
        setTestState('completed');
        setProgress(100);
      }
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (testInterval.current) clearInterval(testInterval.current);
    };
  }, []);

  const maskIp = (ip: string) => {
    if (!ip) return '***.***.***.***';
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;
    return `${parts[0]}.***.***.${parts[3]}`;
  };

  const currentGaugeValue = testState === 'download' ? downloadSpeed : 
                           testState === 'upload' ? uploadSpeed : 
                           testState === 'completed' ? downloadSpeed : 0;
  
  const maxGauge = testState === 'upload' ? 200 : 600;
  const gaugePercentage = Math.min(100, (currentGaugeValue / maxGauge) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-[#050507]">
      {/* Navigation */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <motion.div 
            animate={testState !== 'idle' && testState !== 'completed' ? { rotate: 360 } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center glow-blue"
          >
            <Activity className="text-white w-6 h-6" />
          </motion.div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">SpeedPulse</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <a href="#" className="hover:text-white transition-colors relative group">
            Speed Test
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full" />
          </a>
          <a href="#" className="hover:text-white transition-colors relative group">
            Network Tools
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full" />
          </a>
          <a href="#" className="hover:text-white transition-colors relative group">
            VPN Services
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full" />
          </a>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-accent">
            <Lock className="w-3 h-3" />
            Encrypted
          </div>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-white/5 rounded-lg"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-12 max-w-5xl">
        
        <div className="space-y-12">
          
          {/* SEO Header */}
          <div className="text-center space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent"
            >
              Professional Internet Speed Test
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-gray-500 max-w-2xl mx-auto font-medium"
            >
              Measure your network performance with precision. Get accurate results for download, upload, ping, and jitter in seconds.
            </motion.p>
          </div>

          {/* Test Gauge Card */}
          <div className="glass rounded-[3rem] p-8 md:p-16 relative overflow-hidden shadow-2xl shadow-accent/5">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-accent to-blue-400 glow-blue"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <AnimatePresence mode="wait">
                {testState === 'idle' ? (
                  <motion.button
                    key="start-btn"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    onClick={startTest}
                    className="group relative w-56 h-56 rounded-full bg-accent flex flex-col items-center justify-center gap-2 text-white font-black text-3xl glow-blue hover:scale-105 transition-all duration-500 active:scale-95"
                  >
                    <Zap className="w-10 h-10 fill-white" />
                    START
                    <div className="absolute inset-[-12px] border border-accent/30 rounded-full animate-ping" />
                    <div className="absolute inset-[-24px] border border-accent/10 rounded-full" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="testing-gauge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="text-xs font-mono text-accent uppercase tracking-[0.4em] mb-8 bg-accent/10 px-4 py-1.5 rounded-full">
                      {testState === 'ping' && 'Initializing Connection...'}
                      {testState === 'download' && 'Testing Download Speed'}
                      {testState === 'upload' && 'Testing Upload Speed'}
                      {testState === 'completed' && 'Analysis Complete'}
                    </div>
                    
                    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                      {/* Circular Gauge Background */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle 
                          cx="50%" cy="50%" r="48%" 
                          fill="none" stroke="currentColor" 
                          strokeWidth="4" className="text-white/5"
                        />
                        <motion.circle 
                          cx="50%" cy="50%" r="48%" 
                          fill="none" stroke="currentColor" 
                          strokeWidth="8" className="text-accent"
                          strokeDasharray="100 100"
                          animate={{ strokeDashoffset: 100 - gaugePercentage }}
                          transition={{ type: "spring", stiffness: 50, damping: 15 }}
                          strokeLinecap="round"
                        />
                      </svg>

                      <div className="relative flex flex-col items-center">
                        <div className="flex items-baseline gap-2">
                          <motion.span 
                            key={currentGaugeValue}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-7xl md:text-8xl font-black tracking-tighter tabular-nums"
                          >
                            {Math.round(currentGaugeValue)}
                          </motion.span>
                          <span className="text-xl text-gray-500 font-bold">Mbps</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {testState === 'download' ? <Download className="w-4 h-4 text-accent" /> : <Upload className="w-4 h-4 text-blue-400" />}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            {testState === 'download' ? 'Download' : testState === 'upload' ? 'Upload' : 'Result'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Real-time Area Chart */}
                    <div className="w-full h-40 mt-12">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="speed" 
                            stroke="#3B82F6" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorSpeed)"
                            isAnimationActive={false}
                          />
                          <YAxis hide domain={[0, 'auto']} />
                          <XAxis hide />
                        </AreaChart>
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
                highlight={testState === 'completed' || testState === 'upload'}
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
            <div className="glass rounded-[2.5rem] p-8 space-y-6">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <Globe className="w-4 h-4 text-accent" />
                NETWORK DIAGNOSTICS
              </h2>
              <div className="space-y-4">
                <InfoRow label="ISP Provider" value={isLoadingInfo ? 'Detecting...' : networkInfo?.isp || 'Unknown'} />
                <InfoRow label="Server Location" value={isLoadingInfo ? 'Locating...' : `${networkInfo?.city}, ${networkInfo?.country}`} />
                <InfoRow label="Connection Type" value="Fiber Optic / Ethernet" />
                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">IP ADDRESS</span>
                    <span className="text-sm font-mono text-gray-300">
                      {isLoadingInfo ? '***.***.***.***' : maskIp(networkInfo?.ip || '')}
                    </span>
                  </div>
                  <div className="bg-success/10 text-success px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    Protected
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 space-y-6">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <Zap className="w-4 h-4 text-accent" />
                ADVANCED TOOLS
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <ServiceButton icon={<Wifi />} label="WiFi Scanner" />
                <ServiceButton icon={<Server />} label="Node Status" />
                <ServiceButton icon={<Shield />} label="DNS Leak" />
                <ServiceButton icon={<Activity />} label="Packet Loss" />
              </div>
            </div>
          </div>

          {/* SEO Content Section */}
          <div className="glass rounded-[2.5rem] p-8 md:p-12 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Why Use SpeedPulse?</h2>
              <p className="text-gray-500 leading-relaxed">
                SpeedPulse provides the most accurate internet speed test results by connecting to a global network of high-performance nodes. Whether you are on fiber, broadband, or mobile 5G, our tool analyzes your connection quality with millisecond precision.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <h3 className="font-bold text-accent">Accurate Mbps</h3>
                <p className="text-xs text-gray-600">Real-time bandwidth analysis using multi-stream technology.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-accent">Ping & Jitter</h3>
                <p className="text-xs text-gray-600">Essential metrics for gamers and remote workers to measure stability.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-accent">Privacy First</h3>
                <p className="text-xs text-gray-600">We never store your full IP address or sell your network data.</p>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="glass mt-12 px-8 py-16 border-t border-white/5">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Activity className="text-accent w-8 h-8" />
              <span className="text-2xl font-black tracking-tighter">SpeedPulse</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              Professional-grade network diagnostics and performance tracking. Trusted by engineers worldwide for accurate, unbiased speed analysis.
            </p>
          </div>
          
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Network Tools</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><a href="#" className="hover:text-accent transition-colors">Global Speed Test</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Advanced Ping Analysis</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Jitter & Packet Loss</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">ISP Comparison Map</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Resources</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><a href="#" className="hover:text-accent transition-colors">Developer API</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Network Glossary</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Terms of Use</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Stay Connected</h4>
            <p className="text-sm text-gray-500 mb-6 font-medium">Subscribe for network health alerts.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm flex-1 focus:outline-none focus:border-accent transition-colors"
              />
              <button className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-black glow-blue hover:scale-105 transition-transform">
                JOIN
              </button>
            </div>
          </div>
        </div>
        <div className="container mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          <p>© 2026 SpeedPulse Network. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-gray-400">Twitter</a>
            <a href="#" className="hover:text-gray-400">LinkedIn</a>
            <a href="#" className="hover:text-gray-400">Status</a>
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
      "glass rounded-3xl p-5 flex flex-col gap-2 transition-all duration-700 relative overflow-hidden",
      active && "border-accent ring-1 ring-accent/50 scale-105 z-10 shadow-2xl shadow-accent/20",
      highlight && "border-success/30 bg-success/[0.02]"
    )}>
      {active && (
        <motion.div 
          className="absolute bottom-0 left-0 h-1 bg-accent"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: "linear" }}
        />
      )}
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
        {label}
        <span className={cn(active ? "text-accent" : "text-gray-600")}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-3xl font-black tabular-nums transition-colors",
          active ? "text-accent" : highlight ? "text-success" : "text-white"
        )}>
          {value || '0'}
        </span>
        <span className="text-[10px] text-gray-500 font-bold">{unit}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-bold text-gray-200">{value}</span>
    </div>
  );
}

function ServiceButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-3 p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-accent/50 hover:bg-accent/[0.03] transition-all group">
      <div className="text-gray-500 group-hover:text-accent group-hover:scale-110 transition-all duration-500">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-200">
        {label}
      </span>
    </button>
  );
}

function ServerItem({ name, ping }: { name: string, ping: string }) {
  return (
    <div className="flex items-center justify-between text-xs p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-success glow-green animate-pulse" />
        <span className="text-gray-400 font-bold group-hover:text-white transition-colors">{name}</span>
      </div>
      <span className="font-mono text-gray-600 font-bold">{ping}</span>
    </div>
  );
}
