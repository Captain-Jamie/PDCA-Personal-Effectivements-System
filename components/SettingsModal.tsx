import React, { useState, useEffect } from 'react';
import { BioClockConfig } from '../types';
import { getBioClockConfig, saveBioClockConfig } from '../services/storage';
import { REGISTRATION_INVITE_CODE } from '../constants';
import { supabase, disconnectSupabaseConnection } from '../src/supabaseClient';
import { X, Save, Clock, Trash2, Plus, User, Settings, Shield } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'account' | 'bio' | 'general';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [bioConfig, setBioConfig] = useState<BioClockConfig>({
    sleepWindow: ["23:00", "07:00"],
    meals: []
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getBioClockConfig().then(setBioConfig);
      if(supabase) {
          (supabase.auth as any).getUser().then(({ data: { user } }: any) => {
              if(user) setUserEmail(user.email);
          });
      }
    }
  }, [isOpen]);

  const handleSaveBio = async () => {
    await saveBioClockConfig(bioConfig);
    alert("生物钟设置已保存！注意：更改主要应用于之后创建的新日期。");
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

  if (!isOpen) return null;

  const TabButton = ({ id, label, icon: Icon }: { id: SettingsTab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
      >
          <Icon className="w-5 h-5" />
          {label}
      </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl h-[600px] rounded-2xl shadow-2xl flex overflow-hidden animate-fade-in">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-6 px-2">设置</h2>
                <div className="space-y-2">
                    <TabButton id="account" label="账户设置" icon={User} />
                    <TabButton id="bio" label="生物钟设置" icon={Clock} />
                    <TabButton id="general" label="常规设置" icon={Settings} />
                </div>
            </div>
            <div className="text-xs text-slate-400 px-2">Version 1.0.0</div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-slate-100 flex justify-end">
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
                
                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">账户信息</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">当前用户</label>
                                    <div className="text-slate-800 font-medium">{userEmail || '本地访客模式 (未登录)'}</div>
                                </div>
                                <div className="pt-2 border-t border-slate-200">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">注册邀请码</label>
                                    <div className="flex items-center gap-2">
                                        <code className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-sm font-mono">{REGISTRATION_INVITE_CODE}</code>
                                        <span className="text-xs text-slate-500">此系统为邀请制，注册需凭此码。</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">危险区域</h3>
                            <div className="border border-red-100 bg-red-50 rounded-xl p-4">
                                <h4 className="font-bold text-red-700 text-sm mb-2">注销账户连接</h4>
                                <p className="text-xs text-red-600 mb-4">这将断开与云端数据库的连接，并清除本地缓存的登录信息。</p>
                                <button 
                                    onClick={disconnectSupabaseConnection}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    注销并刷新
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* BIO CLOCK TAB */}
                {activeTab === 'bio' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-lg font-bold text-slate-800">生物钟配置</h3>
                             <button onClick={handleSaveBio} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"><Save className="w-4 h-4"/> 保存</button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">配置睡眠和用餐时间，系统将在每日计划中自动锁定这些时间段。</p>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">🌙 睡眠窗口</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">入睡时间</label>
                                    <input type="time" value={bioConfig.sleepWindow[0]} onChange={(e) => setBioConfig({...bioConfig, sleepWindow: [e.target.value, bioConfig.sleepWindow[1]]})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">起床时间</label>
                                    <input type="time" value={bioConfig.sleepWindow[1]} onChange={(e) => setBioConfig({...bioConfig, sleepWindow: [bioConfig.sleepWindow[0], e.target.value]})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"/>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">🍽️ 用餐与固定锚点</h4>
                                <button onClick={addMeal} className="text-xs flex items-center gap-1 text-brand-600 font-bold hover:underline"><Plus className="w-3 h-3" /> 添加锚点</button>
                            </div>
                            <div className="space-y-3">
                                {bioConfig.meals.map((meal, idx) => (
                                    <div key={idx} className="flex gap-3 items-end bg-slate-50 p-3 rounded-lg">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">名称</label>
                                            <input value={meal.name} onChange={(e) => updateMeal(idx, 'name', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"/>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">时间</label>
                                            <input type="time" value={meal.time} onChange={(e) => updateMeal(idx, 'time', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"/>
                                        </div>
                                        <div className="w-20">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">时长(分)</label>
                                            <input type="number" value={meal.duration} onChange={(e) => updateMeal(idx, 'duration', parseInt(e.target.value))} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"/>
                                        </div>
                                        <button onClick={() => removeMeal(idx)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fade-in text-center py-10">
                        <div className="bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <Settings className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">更多功能开发中</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">主题切换、通知设置、数据备份等功能将在后续版本中推出。</p>
                    </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;