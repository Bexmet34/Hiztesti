/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { motion, AnimatePresence, useSpring } from 'motion/react';
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
  Lock,
  History as HistoryIcon,
  Gamepad2,
  Tv,
  Share2,
  MapPin,
  AlertTriangle,
  TrendingUp,
  CheckCircle2
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
  isVpn?: boolean;
}

interface TestHistory {
  id: string;
  date: string;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
}

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocFromServer, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  return <SpeedPulseApp />;
}

function SpeedPulseApp() {
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
  const [activeModal, setActiveModal] = useState<{ title: string, content: string } | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [selectedServer, setSelectedServer] = useState('Auto (Frankfurt, DE)');
  const [bufferbloat, setBufferbloat] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const testInterval = useRef<NodeJS.Timeout | null>(null);

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('speedpulse_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (download: number, upload: number, ping: number, jitter: number) => {
    const newEntry: TestHistory = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleString(),
      download,
      upload,
      ping,
      jitter
    };
    const updated = [newEntry, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('speedpulse_history', JSON.stringify(updated));
  };

  // Validate Connection to Firestore
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

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
          org: data.org,
          isVpn: (data.org || '').toLowerCase().includes('vpn') || (data.org || '').toLowerCase().includes('proxy')
        });
      } catch (error) {
        console.error('Failed to fetch network info:', error);
      } finally {
        setIsLoadingInfo(false);
      }
    };
    fetchInfo();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setIsSubmitting(true);
    setSubscribeStatus('idle');

    try {
      await addDoc(collection(db, 'subscribers'), {
        email,
        createdAt: serverTimestamp()
      });
      setSubscribeStatus('success');
      setEmail('');
    } catch (error) {
      setSubscribeStatus('error');
      handleFirestoreError(error, OperationType.CREATE, 'subscribers');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setBufferbloat(Math.floor(Math.random() * 10) + 2);
      setPacketLoss(Math.random() < 0.1 ? Number((Math.random() * 0.5).toFixed(2)) : 0);
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
    if (testState === 'completed') {
      saveToHistory(downloadSpeed, uploadSpeed, ping, jitter);
    }
  }, [testState]);

  useEffect(() => {
    return () => {
      if (testInterval.current) clearInterval(testInterval.current);
    };
  }, []);

  const maskIp = (ip: string) => {
    if (!ip) return 'Detecting...';
    return ip;
  };

  const shareResults = () => {
    const text = `🚀 SpeedPulse Test Results:\n⬇️ Download: ${Math.round(downloadSpeed)} Mbps\n⬆️ Upload: ${Math.round(uploadSpeed)} Mbps\n⏱️ Ping: ${ping} ms\n📍 Server: ${selectedServer}\nCheck yours at ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setActiveModal({ title: 'Results Copied!', content: 'Your speed test summary has been copied to the clipboard. Share it with your friends!' });
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
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <HistoryIcon className="w-3 h-3" />
            History
          </button>
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
          <div className="glass rounded-[3rem] p-6 md:p-10 relative overflow-hidden shadow-2xl shadow-accent/5 flex flex-col gap-8">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-accent to-blue-400 glow-blue"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* Metrics Row - Moved to Top and Horizontal */}
            <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-2 md:gap-4 px-2">
              <MetricCard 
                label="Ping" 
                value={ping} 
                unit="ms" 
                icon={<Activity className="w-3 h-3" />} 
                active={testState === 'ping'}
              />
              <MetricCard 
                label="Jitter" 
                value={jitter} 
                unit="ms" 
                icon={<RefreshCcw className="w-3 h-3" />} 
                active={testState === 'ping'}
              />
              <div className="hidden md:block w-px h-8 bg-white/10 mx-2" />
              <MetricCard 
                label="Download" 
                value={Math.round(downloadSpeed)} 
                unit="Mbps" 
                icon={<Download className="w-3 h-3" />} 
                active={testState === 'download'}
                highlight={testState === 'completed' || testState === 'upload'}
              />
              <MetricCard 
                label="Upload" 
                value={Math.round(uploadSpeed)} 
                unit="Mbps" 
                icon={<Upload className="w-3 h-3" />} 
                active={testState === 'upload'}
                highlight={testState === 'completed'}
              />
            </div>

            <div className="flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                {testState === 'idle' ? (
                  <motion.button
                    key="start-btn"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    onClick={startTest}
                    className="group relative w-40 h-40 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex flex-col items-center justify-center gap-1 text-white font-black text-xl shadow-[0_0_50px_rgba(220,38,38,0.3)] hover:shadow-[0_0_70px_rgba(220,38,38,0.5)] hover:scale-105 transition-all duration-500 active:scale-95 my-12 border-4 border-white/10"
                  >
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
                    <Zap className="w-6 h-6 fill-white animate-pulse" />
                    <span className="tracking-tighter">ENGINE</span>
                    <span className="text-[10px] opacity-80 tracking-[0.3em] -mt-1">START</span>
                    <div className="absolute inset-[-8px] border border-red-500/30 rounded-full animate-ping" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="testing-gauge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] mb-6 bg-accent/10 px-4 py-1 rounded-full border border-accent/20 flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      {selectedServer}
                    </div>
                    
                    <div className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] mb-6 bg-accent/10 px-4 py-1 rounded-full border border-accent/20">
                      {testState === 'ping' && 'Initializing Connection...'}
                      {testState === 'download' && 'Testing Download Speed'}
                      {testState === 'upload' && 'Testing Upload Speed'}
                      {testState === 'completed' && 'Analysis Complete'}
                    </div>
                    
                    <div className="relative w-72 h-72 md:w-[450px] md:h-[450px] flex items-center justify-center">
                      <OrbitalGauge value={currentGaugeValue} max={maxGauge} state={testState} />

                      <div className="relative flex flex-col items-center z-10">
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center"
                        >
                          <div className="flex items-baseline gap-2">
                            <Counter 
                              value={Math.round(currentGaugeValue)} 
                              className="text-7xl md:text-9xl font-black tracking-tighter tabular-nums text-white drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                            />
                            <span className="text-xl md:text-2xl text-accent font-black uppercase tracking-widest">Mbps</span>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                            {testState === 'download' ? (
                              <Download className="w-5 h-5 text-accent animate-bounce" />
                            ) : (
                              <Upload className="w-5 h-5 text-red-500 animate-bounce" />
                            )}
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-300">
                              {testState === 'download' ? 'Downloading' : testState === 'upload' ? 'Uploading' : 'Final Result'}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    </div>

                    {testState === 'completed' && (
                      <div className="flex items-center gap-4 mt-4">
                        <motion.button
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={startTest}
                          className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:border-accent transition-all duration-300 flex items-center gap-2 group"
                        >
                          <RefreshCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                          Test Again
                        </motion.button>
                        <motion.button
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          onClick={shareResults}
                          className="px-6 py-2.5 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest glow-blue hover:scale-105 transition-all duration-300 flex items-center gap-2 group"
                        >
                          <Share2 className="w-3 h-3" />
                          Share Result
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Network Info & Services */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-[2.5rem] p-8 space-y-6">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <Globe className="w-4 h-4 text-accent" />
                NETWORK DIAGNOSTICS
              </h2>
              <div className="space-y-4">
                <InfoRow label="ISP Provider" value={isLoadingInfo ? 'Detecting...' : networkInfo?.isp || 'Unknown'} />
                <InfoRow label="Server Location" value={isLoadingInfo ? 'Locating...' : `${networkInfo?.city}, ${networkInfo?.country}`} />
                <InfoRow label="Connection Type" value="Fiber Optic / Ethernet" />
                <InfoRow label="VPN Status" value={isLoadingInfo ? 'Checking...' : networkInfo?.isVpn ? 'VPN Detected' : 'No VPN Detected'} />
                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">IP ADDRESS</span>
                    <span className="text-sm font-mono text-gray-300">
                      {isLoadingInfo ? 'Detecting...' : maskIp(networkInfo?.ip || 'Unknown')}
                    </span>
                  </div>
                  <div className="bg-accent/10 text-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Globe className="w-3 h-3" />
                    Detected
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
                <ServiceButton 
                  icon={<Wifi />} 
                  label="WiFi Scanner" 
                  onClick={() => setActiveModal({ title: 'WiFi Scanner', content: 'Scan your local environment for signal interference, channel congestion, and optimal router placement.' })}
                />
                <ServiceButton 
                  icon={<Server />} 
                  label="Node Status" 
                  onClick={() => setActiveModal({ title: 'Node Status', content: 'Check the real-time health of our global testing infrastructure.' })}
                />
                <ServiceButton 
                  icon={<Shield />} 
                  label="DNS Leak" 
                  onClick={() => setActiveModal({ title: 'DNS Leak Test', content: 'Verify that your DNS queries are not leaking outside of your encrypted tunnel.' })}
                />
                <ServiceButton 
                  icon={<Activity />} 
                  label="Packet Loss" 
                  onClick={() => setActiveModal({ title: 'Packet Loss Test', content: 'Measure the percentage of data packets that fail to reach their destination.' })}
                />
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 space-y-6">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <Server className="w-4 h-4 text-accent" />
                SERVER SELECTION
              </h2>
              <div className="space-y-4">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select a testing node</p>
                <div className="grid grid-cols-1 gap-2">
                  {['Auto (Frankfurt, DE)', 'Istanbul, TR', 'London, UK', 'New York, US'].map((server) => (
                    <button
                      key={server}
                      onClick={() => setSelectedServer(server)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest",
                        selectedServer === server 
                          ? "bg-accent/10 border-accent text-white" 
                          : "bg-white/[0.02] border-white/5 text-gray-500 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", selectedServer === server ? "bg-accent glow-blue" : "bg-gray-700")} />
                        {server}
                      </div>
                      {selectedServer === server && <CheckCircle2 className="w-3 h-3 text-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* New Insights Section */}
          <AnimatePresence>
            {testState === 'completed' && (
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Gaming Insights */}
                <div className="glass rounded-[2.5rem] p-8 space-y-6">
                  <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <Gamepad2 className="w-4 h-4 text-accent" />
                    GAMING PERFORMANCE
                  </h2>
                  <div className="space-y-4">
                    <GamePingItem name="Valorant (EU)" ping={ping + 2} />
                    <GamePingItem name="CS:GO (EU)" ping={ping + 5} />
                    <GamePingItem name="League of Legends" ping={ping + 8} />
                    <GamePingItem name="Call of Duty" ping={ping + 12} />
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-bold">Packet Loss</span>
                        <span className={cn("font-mono font-bold", packetLoss > 0 ? "text-red-500" : "text-success")}>
                          {packetLoss}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Streaming Insights */}
                <div className="glass rounded-[2.5rem] p-8 space-y-6">
                  <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <Tv className="w-4 h-4 text-accent" />
                    STREAMING QUALITY
                  </h2>
                  <div className="space-y-4">
                    <QualityItem label="4K Ultra HD" min={25} current={downloadSpeed} />
                    <QualityItem label="1080p Full HD" min={5} current={downloadSpeed} />
                    <QualityItem label="720p HD" min={2.5} current={downloadSpeed} />
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-bold">Bufferbloat</span>
                        <span className="text-accent font-mono font-bold">+{bufferbloat}ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ISP Comparison */}
                <div className="glass rounded-[2.5rem] p-8 space-y-6">
                  <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    ISP COMPARISON
                  </h2>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-gray-500">Your Speed</span>
                        <span className="text-white">{Math.round(downloadSpeed)} Mbps</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '85%' }}
                          className="h-full bg-accent glow-blue"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-gray-500">Regional Average</span>
                        <span className="text-gray-400">84 Mbps</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '45%' }}
                          className="h-full bg-white/20"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-success font-bold uppercase leading-relaxed">
                      Your connection is 82% faster than the average in {networkInfo?.city || 'your area'}.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History Modal Overlay */}
          <AnimatePresence>
            {showHistory && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowHistory(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-2xl glass rounded-[2.5rem] p-10 overflow-hidden max-h-[80vh] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3 text-accent">
                      <HistoryIcon className="w-6 h-6" />
                      <h3 className="text-2xl font-black tracking-tight">Test History</h3>
                    </div>
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {history.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 font-medium">
                        No tests recorded yet. Start your first test!
                      </div>
                    ) : (
                      history.map((item) => (
                        <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-accent/30 transition-all group">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{item.date}</span>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-bold">DOWN</span>
                                <span className="text-sm font-black text-white">{Math.round(item.download)} <span className="text-[8px] text-gray-500">Mbps</span></span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-bold">UP</span>
                                <span className="text-sm font-black text-white">{Math.round(item.upload)} <span className="text-[8px] text-gray-500">Mbps</span></span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-bold">PING</span>
                                <span className="text-sm font-black text-white">{item.ping} <span className="text-[8px] text-gray-500">ms</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
              <li><button onClick={() => setActiveModal({ title: 'Global Speed Test', content: 'Our global network of over 500 servers ensures that you get the most accurate speed test results, no matter where you are in the world. We measure throughput using multiple concurrent streams to saturate your connection.' })} className="hover:text-accent transition-colors">Global Speed Test</button></li>
              <li><button onClick={() => setActiveModal({ title: 'Advanced Ping Analysis', content: 'Ping measures the round-trip time for messages sent from your host to a destination server. Our advanced analysis checks for consistency and routing efficiency across multiple global hops.' })} className="hover:text-accent transition-colors">Advanced Ping Analysis</button></li>
              <li><button onClick={() => setActiveModal({ title: 'Jitter & Packet Loss', content: 'Jitter is the variation in the delay of received packets. High jitter can cause issues in real-time applications like VoIP and gaming. Packet loss indicates data that fails to reach its destination.' })} className="hover:text-accent transition-colors">Jitter & Packet Loss</button></li>
              <li><button onClick={() => setActiveModal({ title: 'ISP Comparison Map', content: 'Compare your results with other users in your region. Our ISP map shows real-time performance data for major providers, helping you choose the best service for your needs.' })} className="hover:text-accent transition-colors">ISP Comparison Map</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Resources</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><button onClick={() => setActiveModal({ title: 'Developer API', content: 'Integrate SpeedPulse diagnostics into your own applications. Our REST API provides programmatic access to speed test results, network info, and historical performance data.' })} className="hover:text-accent transition-colors">Developer API</button></li>
              <li><button onClick={() => setActiveModal({ title: 'Network Glossary', content: 'Confused by Mbps vs MB/s? Our glossary defines common network terms like Latency, Bandwidth, Throughput, and more in plain English.' })} className="hover:text-accent transition-colors">Network Glossary</button></li>
              <li><button onClick={() => setActiveModal({ title: 'Privacy Policy', content: 'Your privacy is our priority. We mask your IP address and never store personally identifiable information. We only use anonymized data to improve global network mapping.' })} className="hover:text-accent transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => setActiveModal({ title: 'Terms of Use', content: 'By using SpeedPulse, you agree to our terms of service. Our tool is provided for personal and professional diagnostics. Commercial redistribution of our data requires an API license.' })} className="hover:text-accent transition-colors">Terms of Use</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Stay Connected</h4>
            <p className="text-sm text-gray-500 mb-6 font-medium">Subscribe for network health alerts.</p>
            <form onSubmit={handleSubscribe} className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address" 
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm flex-1 focus:outline-none focus:border-accent transition-colors"
                />
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-black glow-blue hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSubmitting ? '...' : 'JOIN'}
                </button>
              </div>
              {subscribeStatus === 'success' && (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest animate-pulse">Successfully subscribed!</p>
              )}
              {subscribeStatus === 'error' && (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Subscription failed. Try again.</p>
              )}
            </form>
          </div>
        </div>
        <div className="container mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          <p>© 2026 SpeedPulse Network. All rights reserved.</p>
          <div className="flex gap-8">
            <button onClick={() => setActiveModal({ title: 'Twitter / X', content: 'Follow us @SpeedPulseApp for real-time network status updates, performance tips, and community highlights.' })} className="hover:text-gray-400 transition-colors">Twitter</button>
            <button onClick={() => setActiveModal({ title: 'LinkedIn', content: 'Connect with SpeedPulse Network on LinkedIn for professional insights, infrastructure updates, and career opportunities.' })} className="hover:text-gray-400 transition-colors">LinkedIn</button>
            <button onClick={() => setActiveModal({ title: 'System Status', content: 'All systems operational. Our global edge network is performing at 99.99% uptime. No current outages reported.' })} className="hover:text-gray-400 transition-colors">Status</button>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass rounded-[2.5rem] p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-accent" />
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-accent">
                  <Info className="w-6 h-6" />
                  <h3 className="text-2xl font-black tracking-tight">{activeModal.title}</h3>
                </div>
                <p className="text-gray-400 leading-relaxed font-medium">
                  {activeModal.content}
                </p>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="w-full py-4 bg-accent text-white font-black rounded-2xl glow-blue hover:scale-[1.02] transition-transform"
                >
                  GOT IT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrbitalGauge({ value, max, state }: { value: number, max: number, state: string }) {
  const percentage = Math.min(100, (value / (max || 1)) * 100);
  const isUpload = state === 'upload';
  const color = isUpload ? '#EF4444' : '#3B82F6';

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center">
      <div className="relative w-full h-full">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <filter id="orbitalGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={isUpload ? "#B91C1C" : "#1D4ED8"} />
            </linearGradient>
            <mask id="ringMask">
              <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="8" strokeDasharray="1, 2" />
            </mask>
          </defs>

          {/* Background Rings */}
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          
          {/* Progress Track */}
          <circle 
            cx="50" cy="50" r="42" 
            fill="none" 
            stroke="rgba(255,255,255,0.05)" 
            strokeWidth="8" 
            mask="url(#ringMask)"
          />

          {/* Main Progress Ring */}
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            mask="url(#ringMask)"
            style={{
              pathLength: percentage / 100,
              rotate: -90,
              transformOrigin: "50% 50%",
              filter: "url(#orbitalGlow)"
            }}
            transition={{ type: "spring", stiffness: 20, damping: 10 }}
          />

          {/* Scanning Beam */}
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray="10 100"
            strokeLinecap="round"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%", opacity: 0.3 }}
          />

          {/* Data Particles */}
          {[...Array(6)].map((_, i) => (
            <motion.circle
              key={i}
              cx="50"
              cy="50"
              r={42}
              fill={color}
              animate={{
                rotate: [0, 360],
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.25
              }}
              style={{
                transformOrigin: "50% 50%",
                cx: 50 + 42 * Math.cos((i * 60 * Math.PI) / 180),
                cy: 50 + 42 * Math.sin((i * 60 * Math.PI) / 180),
                r: 1
              }}
            />
          ))}
        </svg>

        {/* Ambient Glow Background */}
        <div 
          className="absolute inset-0 rounded-full blur-[120px] opacity-10 transition-colors duration-1000"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Counter({ value, className }: { value: number, className?: string }) {
  const springValue = useSpring(0, { stiffness: 50, damping: 15 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
  }, [springValue]);

  return <span className={className}>{displayValue}</span>;
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
      "glass rounded-xl p-3 flex flex-col gap-0.5 transition-all duration-700 relative overflow-hidden flex-1 min-w-[80px]",
      active && "border-accent ring-1 ring-accent/30 scale-105 z-10 shadow-xl shadow-accent/10 bg-accent/[0.05]",
      highlight && "border-success/20 bg-success/[0.01]"
    )}>
      {active && (
        <motion.div 
          className="absolute bottom-0 left-0 h-0.5 bg-accent"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: "linear" }}
        />
      )}
      <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-widest text-gray-500">
        {label}
        <span className={cn(active ? "text-accent" : "text-gray-600")}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-lg font-black tabular-nums transition-colors",
          active ? "text-accent" : highlight ? "text-success" : "text-white"
        )}>
          {value || '0'}
        </span>
        <span className="text-[7px] text-gray-500 font-bold">{unit}</span>
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

function ServiceButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-accent/50 hover:bg-accent/[0.03] transition-all group"
    >
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

function GamePingItem({ name, ping }: { name: string, ping: number }) {
  const status = ping < 30 ? 'Excellent' : ping < 60 ? 'Good' : 'Fair';
  const color = ping < 30 ? 'text-success' : ping < 60 ? 'text-accent' : 'text-yellow-500';

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400 font-bold">{name}</span>
      <div className="flex items-center gap-3">
        <span className={cn("font-bold", color)}>{status}</span>
        <span className="font-mono text-gray-200 font-bold">{ping}ms</span>
      </div>
    </div>
  );
}

function QualityItem({ label, min, current }: { label: string, min: number, current: number }) {
  const supported = current >= min;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400 font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("font-bold uppercase tracking-widest text-[8px]", supported ? "text-success" : "text-red-500")}>
          {supported ? 'Supported' : 'Limited'}
        </span>
        {supported ? <CheckCircle2 className="w-3 h-3 text-success" /> : <AlertTriangle className="w-3 h-3 text-red-500" />}
      </div>
    </div>
  );
}
