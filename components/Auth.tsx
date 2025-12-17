import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, setupSupabaseConnection } from '../src/supabaseClient';
import { LayoutDashboard, LogIn, UserPlus, Loader2, CloudCog, X, ShieldCheck, Mail, Lock, KeyRound, ArrowRight, RefreshCw, Send } from 'lucide-react';

interface AuthProps {
    onClose?: () => void;
}

type AuthView = 'login' | 'signup' | 'forgot_password';
type LoginMethod = 'code' | 'password';

export const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);
  
  // View State
  const [view, setView] = useState<AuthView>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password'); // Default to password as per generic ux, but swappable
  
  // Form Data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Config State
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');
  const isConfigured = isSupabaseConfigured();

  // Timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset state on view change
  const switchView = (v: AuthView) => {
      setView(v);
      setMsg('');
      setError(false);
      setOtpSent(false);
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      // Keep email for convenience
  };

  const sendOtp = async (shouldCreateUser: boolean = true) => {
    if (!email) {
        setError(true);
        setMsg("请输入邮箱地址");
        return;
    }
    setLoading(true);
    setMsg('');
    try {
        const { error } = await supabase!.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: shouldCreateUser }
        });
        if (error) throw error;
        
        setOtpSent(true);
        setCountdown(60);
        setMsg('验证码已发送，请检查邮箱');
        setError(false);
    } catch (err: any) {
        setError(true);
        setMsg(err.message || "发送失败，请稍后重试");
    } finally {
        setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!supabase) return;
      setLoading(true);
      setMsg('');
      setError(false);

      try {
          if (loginMethod === 'password') {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
          } else {
              // Login via OTP
              const { error } = await supabase.auth.verifyOtp({
                  email,
                  token: otp,
                  type: 'email'
              });
              if (error) throw error;
          }
          if (onClose) onClose();
      } catch (err: any) {
          setError(true);
          setMsg(err.message || '登录失败，请检查凭证');
      } finally {
          setLoading(false);
      }
  };

  const handleSignUp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!supabase) return;

      if (password !== confirmPassword) {
          setError(true);
          setMsg("两次输入的密码不一致");
          return;
      }

      setLoading(true);
      setMsg('');
      setError(false);

      try {
          // 1. Verify OTP first (this logs the user in if successful)
          const { data: { session }, error: verifyError } = await supabase.auth.verifyOtp({
              email,
              token: otp,
              type: 'email'
          });

          if (verifyError) throw verifyError;
          if (!session) throw new Error("验证失败");

          // 2. Set the password for the user
          const { error: updateError } = await supabase.auth.updateUser({ password: password });
          if (updateError) throw updateError;

          setMsg('注册成功！');
          if (onClose) onClose();
      } catch (err: any) {
          setError(true);
          setMsg(err.message || '注册失败');
      } finally {
          setLoading(false);
      }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!supabase) return;

      if (password !== confirmPassword) {
          setError(true);
          setMsg("两次输入的密码不一致");
          return;
      }

      setLoading(true);
      setMsg('');
      setError(false);

      try {
          // 1. Verify OTP (Logs user in)
          const { data: { session }, error: verifyError } = await supabase.auth.verifyOtp({
              email,
              token: otp,
              type: 'email'
          });
          
          if (verifyError) throw verifyError;
          if (!session) throw new Error("验证失败");

          // 2. Update Password
          const { error: updateError } = await supabase.auth.updateUser({ password: password });
          if (updateError) throw updateError;

          setMsg('密码重置成功，正在登录...');
          setTimeout(() => { if (onClose) onClose(); }, 1000);

      } catch (err: any) {
          setError(true);
          setMsg(err.message || '重置失败');
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
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative animate-fade-in flex flex-col max-h-[90vh]">
        
        {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10">
                <X className="w-5 h-5" />
            </button>
        )}

        <div className="bg-brand-600 p-8 text-center relative shrink-0">
            <div className="inline-flex bg-white/20 p-3 rounded-xl mb-4">
                <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">PDCA<span className="opacity-80">Flow</span></h1>
            <p className="text-brand-100 text-sm">个人效能系统</p>
        </div>

        <div className="p-8 overflow-y-auto">
            {!isConfigured ? (
                // --- CONFIGURATION MODE ---
                <div>
                     <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CloudCog className="w-5 h-5 text-brand-600"/>
                        连接云端数据库
                    </h2>
                    <form onSubmit={handleConfig} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL</label>
                            <input type="text" required value={configUrl} onChange={(e) => setConfigUrl(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="https://xyz.supabase.co" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anon Key</label>
                            <input type="password" required value={configKey} onChange={(e) => setConfigKey(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="Key..." />
                        </div>
                        <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl mt-2">保存并连接</button>
                    </form>
                </div>
            ) : (
                // --- AUTH MODES ---
                <>
                    {/* View Title */}
                    <div className="mb-6 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {view === 'login' && (loginMethod === 'password' ? <LogIn className="w-5 h-5"/> : <Mail className="w-5 h-5"/>)}
                            {view === 'signup' && <UserPlus className="w-5 h-5"/>}
                            {view === 'forgot_password' && <KeyRound className="w-5 h-5"/>}
                            
                            {view === 'login' ? (loginMethod === 'password' ? '密码登录' : '验证码登录') : 
                             view === 'signup' ? '注册账户' : '重置密码'}
                        </h2>
                    </div>

                    {/* LOGIN VIEW */}
                    {view === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Toggle Method Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                <button type="button" onClick={() => setLoginMethod('password')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${loginMethod === 'password' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>密码登录</button>
                                <button type="button" onClick={() => setLoginMethod('code')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${loginMethod === 'code' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>验证码登录</button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="you@example.com" />
                            </div>

                            {loginMethod === 'password' ? (
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-sm font-medium text-slate-700">密码</label>
                                        <button type="button" onClick={() => switchView('forgot_password')} className="text-xs text-brand-600 hover:underline">忘记密码?</button>
                                    </div>
                                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="••••••••" />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">验证码</label>
                                    <div className="flex gap-2">
                                        <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono tracking-widest" placeholder="123456" />
                                        <button type="button" onClick={() => sendOtp(true)} disabled={countdown > 0 || !email} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[100px]">
                                            {countdown > 0 ? `${countdown}s 后重试` : (otpSent ? '重新发送' : '获取验证码')}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">未注册的邮箱将自动创建账户 (隐式注册)。如需设置密码，请在登录后前往设置。</p>
                                </div>
                            )}

                            {msg && <div className={`p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{msg}</div>}

                            <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loginMethod === 'password' ? '登录' : '验证并登录'}
                            </button>
                            
                            <div className="mt-4 text-center text-sm text-slate-500">
                                还没有账户？ <button type="button" onClick={() => switchView('signup')} className="text-brand-600 font-bold hover:underline">注册新账户</button>
                            </div>
                        </form>
                    )}

                    {/* SIGN UP VIEW */}
                    {view === 'signup' && (
                         <form onSubmit={handleSignUp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                <div className="flex gap-2">
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="you@example.com" />
                                    <button type="button" onClick={() => sendOtp(true)} disabled={countdown > 0 || !email} className="px-3 py-2 bg-brand-50 text-brand-600 text-xs font-bold rounded-lg hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                                        {countdown > 0 ? `${countdown}s` : <Send className="w-4 h-4"/>}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱验证码</label>
                                <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono" placeholder="输入收到的验证码" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">设置密码</label>
                                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="••••••" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">确认密码</label>
                                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="••••••" />
                                </div>
                            </div>

                            {msg && <div className={`p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{msg}</div>}

                            <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />} 验证并注册
                            </button>

                            <div className="mt-4 text-center text-sm text-slate-500">
                                <button type="button" onClick={() => switchView('login')} className="text-brand-600 font-bold hover:underline">返回登录</button>
                            </div>
                         </form>
                    )}

                    {/* FORGOT PASSWORD VIEW */}
                    {view === 'forgot_password' && (
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                            <p className="text-sm text-slate-500 mb-2">输入您的邮箱以获取验证码，验证通过后即可重置密码。</p>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                <div className="flex gap-2">
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="you@example.com" />
                                    <button type="button" onClick={() => sendOtp(false)} disabled={countdown > 0 || !email} className="px-3 py-2 bg-brand-50 text-brand-600 text-xs font-bold rounded-lg hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                                        {countdown > 0 ? `${countdown}s` : <Send className="w-4 h-4"/>}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">验证码</label>
                                <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono" placeholder="输入验证码" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">新密码</label>
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="新密码" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">确认新密码</label>
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="再次输入" />
                            </div>

                            {msg && <div className={`p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{msg}</div>}

                            <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />} 重置密码并登录
                            </button>

                            <div className="mt-4 text-center text-sm text-slate-500">
                                <button type="button" onClick={() => switchView('login')} className="text-brand-600 font-bold hover:underline">返回登录</button>
                            </div>
                        </form>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};