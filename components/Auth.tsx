import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, setupSupabaseConnection } from '../src/supabaseClient';
import { LayoutDashboard, LogIn, UserPlus, Loader2, CloudCog, X, ShieldCheck } from 'lucide-react';
import { REGISTRATION_INVITE_CODE } from '../constants';

interface AuthProps {
    onClose?: () => void; // Optional prop to support using Auth as a modal
}

export const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Config State
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');

  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    // Invitation Code Check for Signup
    if (mode === 'signup' && inviteCode !== REGISTRATION_INVITE_CODE) {
        setError(true);
        setMsg("邀请码错误，无法注册。");
        return;
    }

    setLoading(true);
    setMsg('');
    setError(false);

    try {
      if (mode === 'signup') {
        const { error } = await (supabase.auth as any).signUp({
          email,
          password,
        });
        if (error) throw error;
        setMsg('请查看您的邮箱并点击确认链接！');
      } else {
        const { error } = await (supabase.auth as any).signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // If successful, App.tsx will detect session change
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(true);
      setMsg(err.message || '发生了错误');
    } finally {
      setLoading(false);
    }
  };

  const handleConfig = (e: React.FormEvent) => {
      e.preventDefault();
      if(configUrl && configKey) {
          setupSupabaseConnection(configUrl, configKey);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative animate-fade-in">
        
        {/* Close Button if Modal */}
        {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10">
                <X className="w-5 h-5" />
            </button>
        )}

        <div className="bg-brand-600 p-8 text-center relative">
            <div className="inline-flex bg-white/20 p-3 rounded-xl mb-4">
                <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">PDCA<span className="opacity-80">Flow</span></h1>
            <p className="text-brand-100 text-sm">个人效能系统</p>
        </div>

        <div className="p-8">
            {!isConfigured ? (
                // --- CONFIGURATION MODE ---
                <div>
                     <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CloudCog className="w-5 h-5 text-brand-600"/>
                        连接云端数据库
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">
                        输入您的 Supabase 项目详情以启用云同步和用户登录。
                    </p>
                    <form onSubmit={handleConfig} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">项目地址 (URL)</label>
                            <input
                                type="text"
                                required
                                value={configUrl}
                                onChange={(e) => setConfigUrl(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                placeholder="https://xyz.supabase.co"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">公开密钥 (Anon Public Key)</label>
                            <input
                                type="password"
                                required
                                value={configKey}
                                onChange={(e) => setConfigKey(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors mt-2"
                        >
                            保存并连接
                        </button>
                    </form>
                    <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg">
                        还没有数据库？去 <a href="https://supabase.com" target="_blank" className="underline font-bold">database.new</a> 创建一个免费项目
                    </div>
                </div>
            ) : (
                // --- LOGIN MODE ---
                <>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        {mode === 'login' ? <LogIn className="w-5 h-5"/> : <UserPlus className="w-5 h-5"/>}
                        {mode === 'login' ? '登录' : '创建账户'}
                    </h2>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                            <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                            <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="••••••••"
                            />
                        </div>

                        {mode === 'signup' && (
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                                    <ShieldCheck className="w-4 h-4 text-brand-500"/> 邀请码 (防止恶意注册)
                                </label>
                                <input
                                type="text"
                                required
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="请输入邀请码"
                                />
                            </div>
                        )}

                        {msg && (
                            <div className={`p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {msg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'login' ? '登录' : '注册'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500">
                        {mode === 'login' ? "还没有账户？ " : "已有账户？ "}
                        <button 
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(''); }}
                            className="text-brand-600 font-bold hover:underline"
                        >
                            {mode === 'login' ? '去注册' : '去登录'}
                        </button>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};