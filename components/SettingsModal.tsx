import React, { useState, useEffect } from 'react';
import { BioClockConfig } from '../types';
import { getBioClockConfig, saveBioClockConfig } from '../services/storage';
import { X, Save, Clock, Trash2, Plus } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<BioClockConfig>({
    sleepWindow: ["23:00", "07:00"],
    meals: []
  });

  useEffect(() => {
    if (isOpen) {
      setConfig(getBioClockConfig());
    }
  }, [isOpen]);

  const handleSave = () => {
    saveBioClockConfig(config);
    onClose();
    // In a full app, we might trigger a global refresh, 
    // but for now changes apply to new day creation or reload
    alert("Settings saved! Note: Changes to Bio Clock apply primarily to new days created hereafter.");
  };

  const updateMeal = (index: number, field: keyof typeof config.meals[0], value: any) => {
    const newMeals = [...config.meals];
    newMeals[index] = { ...newMeals[index], [field]: value };
    setConfig({ ...config, meals: newMeals });
  };

  const removeMeal = (index: number) => {
    const newMeals = config.meals.filter((_, i) => i !== index);
    setConfig({ ...config, meals: newMeals });
  };

  const addMeal = () => {
    setConfig({
      ...config,
      meals: [...config.meals, { name: "Snack", time: "15:00", duration: 30 }]
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
             <div className="bg-brand-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-brand-600" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">Bio Clock Settings</h2>
                <p className="text-xs text-slate-500">Configure your daily rhythm anchors.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Sleep Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span>🌙</span> Sleep Window
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Bedtime</label>
                        <input 
                            type="time" 
                            value={config.sleepWindow[0]}
                            onChange={(e) => setConfig({...config, sleepWindow: [e.target.value, config.sleepWindow[1]]})}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Wake Up</label>
                         <input 
                            type="time" 
                            value={config.sleepWindow[1]}
                            onChange={(e) => setConfig({...config, sleepWindow: [config.sleepWindow[0], e.target.value]})}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Meals Section */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <span>🍽️</span> Meals & Anchors
                    </h3>
                    <button onClick={addMeal} className="text-xs flex items-center gap-1 text-brand-600 font-medium hover:underline">
                        <Plus className="w-3 h-3" /> Add
                    </button>
                </div>
                
                <div className="space-y-3">
                    {config.meals.map((meal, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                             <div className="flex-1">
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Name</label>
                                <input 
                                    value={meal.name}
                                    onChange={(e) => updateMeal(idx, 'name', e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                             </div>
                             <div className="w-24">
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Time</label>
                                <input 
                                    type="time"
                                    value={meal.time}
                                    onChange={(e) => updateMeal(idx, 'time', e.target.value)}
                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                             </div>
                             <div className="w-20">
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Min</label>
                                <input 
                                    type="number"
                                    value={meal.duration}
                                    onChange={(e) => updateMeal(idx, 'duration', parseInt(e.target.value))}
                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                             </div>
                             <button onClick={() => removeMeal(idx)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium transition-colors shadow-sm"
            >
                <Save className="w-4 h-4" /> Save Settings
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;