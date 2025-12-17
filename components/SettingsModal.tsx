import React, { useState, useEffect } from 'react';
import { BioClockConfig } from '../types';
import { getBioClockConfig, saveBioClockConfig, updateTodayRecordWithBioConfig } from '../services/storage';
import { supabase, disconnectSupabaseConnection } from '../src/supabaseClient';
import { X, Save, Clock, Trash2, Plus, User, Settings, Shield, Moon, Eye, EyeOff, RefreshCw, KeyRound, Check, Info, BookOpen, Target, ArrowRight } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetToday: () => Promise<void>;
}

type SettingsTab = 'account' | 'bio' | 'general' | 'about';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetToday }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('about'); // Default to About for new users contextually, or stick to account. Let's keep account or change if requested. Keeping account default but adding tab.
  const [bioConfig, setBioConfig] = useState<BioClockConfig>({
    sleepWindow: ["23:00", "07:00"],
    meals: [],
    enableSleepFold: true
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getBioClockConfig().then(setBioConfig);
      if(supabase) {
          (supabase.auth as any).getUser().then(({ data: { user } }: any) => {
              if(user) setUserEmail(user.email);
          });
      }
      setPassMsg('');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPwd(false);
      setShowConfirmPwd(false);
    }
  }, [isOpen]);

  const handleSaveBio = async () => {
    await saveBioClockConfig(bioConfig);
    // Explicitly update today's record to use new config, leaving history untouched
    await updateTodayRecordWithBioConfig(bioConfig);
    // Force reload to apply bio clock changes immediately to the view filtering
    window.location.reload(); 
  };

  const updateMeal = (index: number, field: keyof typeof bioConfig.meals[0], value: any) => {
    const newMeals = [...bioConfig.meals];
    newMeals[index] = { ...newMeals[index], [field]: value };
    setBioConfig({ ...bioConfig, meals: newMeals });
  };

  const removeMeal = (index: number) => {
    const newMeals = bioConfig.meals.filter((_, i) => i !== index);
    setBioConfig({ ...bioConfig, meals: newMeals });
  };

  const addMeal = () => {
    setBioConfig({
      ...bioConfig,
      meals: [...bioConfig.meals, { name: "加餐", time: "15:00", duration: 30 }]
    });
  };

  const handleReset = async () => {
      if(confirm("确定要清空今日的所有记录吗？（生物钟设置不会受到影响）此操作无法撤销。")) {
          await onResetToday();
          alert("今日数据已重置。");
          onClose();
      }
  };

  const handleUpdatePassword = async () => {
      if (!newPassword || !confirmPassword) return;
      if (newPassword !== confirmPassword) {
          setPassMsg("❌ 两次密码输入不一致");
          return;
      }
      if (!supabase) return;

      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setPassMsg("✅ 密码已更新");
          setNewPassword('');
          setConfirmPassword('');
      } catch (e: any) {
          setPassMsg(`❌ ${e.message}`);
      }
  };

  if (!isOpen) return null;

  const TabButton = ({ id, label, icon: Icon }: { id: SettingsTab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
      >
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
          {label}
      </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl h-[90vh] md:h-[600px] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-fade-in">
        
        {/* Sidebar (Top on mobile, Left on desktop) */}
        <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 md:p-6 flex flex-row md:flex-col justify-between shrink-0 overflow-x-auto md:overflow-visible scrollbar-hide">
            <div className="flex flex-row md:flex-col gap-2 md:gap-2 w-full">
                <div className="hidden md:block">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 px-2">设置</h2>
                </div>
                <div className="flex flex-row md:flex-col gap-2">
                    <TabButton id="account" label="账户设置" icon={User} />
                    <TabButton id="bio" label="生物钟设置" icon={Clock} />
                    <TabButton id="general" label="常规设置" icon={Settings} />
                    <TabButton id="about" label="应用介绍" icon={Info} />
                </div>
            </div>
            <div className="hidden md:block text-xs text-slate-400 px-2">Version 1.2.0</div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-white min-h-0">
            <div className="p-4 border-b border-slate-100 flex justify-between md:justify-end items-center shrink-0">
                <span className="md:hidden font-bold text-slate-800">设置</span>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                
                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="space-y-8 animate-fade-in pb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">账户信息</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">当前用户</label>
                                    <div className="text-slate-800 font-medium break-all">{userEmail || '本地访客模式 (未登录)'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Password Management */}
                        {userEmail && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4">密码管理</h3>
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">新密码</label>
                                            <div className="relative">
                                                <input type={showNewPwd ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none pr-10" placeholder="输入新密码" />
                                                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                    {showNewPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">确认新密码</label>
                                            <div className="relative">
                                                <input type={showConfirmPwd ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none pr-10" placeholder="再次输入" />
                                                <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                    {showConfirmPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">{passMsg}</span>
                                        <button onClick={handleUpdatePassword} disabled={!newPassword || !confirmPassword} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                            <KeyRound className="w-4 h-4" /> 更新密码
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400">如果您之前使用验证码登录，可在此处设置密码以便下次使用密码登录。</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">危险区域</h3>
                            <div className="border border-red-100 bg-red-50 rounded-xl p-4">
                                <h4 className="font-bold text-red-700 text-sm mb-2">注销账户连接</h4>
                                <p className="text-xs text-red-600 mb-4">这将断开与云端数据库的连接，并清除本地缓存的登录信息。</p>
                                <button 
                                    onClick={disconnectSupabaseConnection}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors w-full md:w-auto"
                                >
                                    注销并刷新
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* BIO CLOCK TAB */}
                {activeTab === 'bio' && (
                    <div className="space-y-6 animate-fade-in pb-8">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-lg font-bold text-slate-800">生物钟配置</h3>
                             <button onClick={handleSaveBio} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"><Save className="w-4 h-4"/> <span className="hidden md:inline">保存</span></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">配置睡眠和用餐时间。起床时间将作为每日的第一个打卡项。</p>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">🌙 睡眠时间</h4>
                                <button 
                                    onClick={() => setBioConfig({...bioConfig, enableSleepFold: !bioConfig.enableSleepFold})}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bioConfig.enableSleepFold ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {bioConfig.enableSleepFold ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                    {bioConfig.enableSleepFold ? '已折叠' : '展开显示'}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">入睡时间</label>
                                    <input type="time" value={bioConfig.sleepWindow[0]} onChange={(e) => setBioConfig({...bioConfig, sleepWindow: [e.target.value, bioConfig.sleepWindow[1]]})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">起床时间</label>
                                    <input type="time" value={bioConfig.sleepWindow[1]} onChange={(e) => setBioConfig({...bioConfig, sleepWindow: [bioConfig.sleepWindow[0], e.target.value]})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"/>
                                    <p className="text-[10px] text-brand-600 mt-1">* 此时间将自动生成为当日的第一行“起床”任务。</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">🍽️ 用餐与固定安排</h4>
                                <button onClick={addMeal} className="text-xs flex items-center gap-1 text-brand-600 font-bold hover:underline"><Plus className="w-3 h-3" /> 添加锚点</button>
                            </div>
                            <div className="space-y-3">
                                {bioConfig.meals.map((meal, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-3 md:items-end bg-slate-50 p-3 rounded-lg">
                                        <div className="flex-1">
                                            <label className="block md:hidden text-[10px] font-bold text-slate-400 mb-1 uppercase">名称</label>
                                            <input value={meal.name} onChange={(e) => updateMeal(idx, 'name', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white" placeholder="名称"/>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-1 md:w-24">
                                                <label className="block md:hidden text-[10px] font-bold text-slate-400 mb-1 uppercase">时间</label>
                                                <input type="time" value={meal.time} onChange={(e) => updateMeal(idx, 'time', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"/>
                                            </div>
                                            <div className="flex-1 md:w-20">
                                                <label className="block md:hidden text-[10px] font-bold text-slate-400 mb-1 uppercase">时长(分)</label>
                                                <input type="number" value={meal.duration} onChange={(e) => updateMeal(idx, 'duration', parseInt(e.target.value))} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"/>
                                            </div>
                                        </div>
                                        <div className="flex justify-end md:block">
                                            <button onClick={() => removeMeal(idx)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fade-in py-4">
                        <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-500"/> 页面数据管理</h3>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 gap-4">
                                <div>
                                    <h4 className="font-semibold text-slate-700 text-sm">重置今日数据</h4>
                                    <p className="text-xs text-slate-500 mt-1">清空今日的所有计划、执行和检查记录。生物钟配置将保留。</p>
                                </div>
                                <button 
                                    onClick={handleReset}
                                    className="w-full md:w-auto px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-red-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    清空并重置
                                </button>
                            </div>
                        </div>

                        <div className="text-center py-6">
                            <p className="text-slate-400 text-sm">更多常规设置（主题、通知）即将推出。</p>
                        </div>
                    </div>
                )}

                {/* ABOUT TAB */}
                {activeTab === 'about' && (
                    <div className="space-y-8 animate-fade-in py-2">
                        {/* What is PDCA */}
                        <section>
                            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-brand-600"/> 
                                什么是 PDCA？
                            </h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-700 text-sm leading-relaxed space-y-4">
                                <p>
                                    PDCA 循环（Plan-Do-Check-Act）是一种广泛应用于质量管理和个人效能提升的迭代模型。它通过四个连续的步骤，帮助您持续改进工作流程和个人习惯。
                                </p>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                        <span className="block font-bold text-brand-600 mb-1">P - Plan (计划)</span>
                                        <span className="text-slate-500 text-xs">设定目标，制定实现目标的具体步骤和时间表。</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                        <span className="block font-bold text-brand-600 mb-1">D - Do (执行)</span>
                                        <span className="text-slate-500 text-xs">按计划付诸实践，并记录实际执行的过程和偏差。</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                        <span className="block font-bold text-brand-600 mb-1">C - Check (检查)</span>
                                        <span className="text-slate-500 text-xs">评估结果，对比计划与实际，分析效率和问题。</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                        <span className="block font-bold text-brand-600 mb-1">A - Act (行动)</span>
                                        <span className="text-slate-500 text-xs">总结经验，标准化成功做法，改进失败点，开启下一个循环。</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* How to use */}
                        <section>
                            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Target className="w-6 h-6 text-brand-600"/> 
                                如何使用本系统？
                            </h3>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold flex items-center justify-center">1</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">配置生物钟 (Set Up)</h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            在“生物钟设置”中设定您的入睡和起床时间。系统会自动折叠睡眠时间，并以<span className="font-bold text-brand-600">起床时间作为每日的第一行</span>，作为您的“早起打卡”标志。
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold flex items-center justify-center">2</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">每日计划与执行 (Plan & Do)</h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            左侧填写入计划，中间记录实际执行情况。如果实际情况与计划一致，直接选择“完成”即可自动填充；否则请记录真实偏差。
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold flex items-center justify-center">3</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">每日闭环 (Review & Act)</h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            点击右下角的浮动按钮结束一天。系统会计算当天的完成率和效率，引导您进行总结，并直接规划明日的 2 个核心任务，确保每天都在进步。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl text-center">
                            <p className="text-brand-800 text-sm font-medium">
                                "凡事预则立，不预则废。" —— 祝您在 PDCA Flow 中找到自己的节奏。
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;