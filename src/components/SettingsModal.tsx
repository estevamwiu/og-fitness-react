import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  X, 
  Save, 
  Volume2, 
  Building, 
  Users, 
  Clock, 
  RotateCcw, 
  Check,
  Dumbbell
} from 'lucide-react';
import { GymSettings } from '../types';
import { soundEffects } from '../utils/audioAlert';
import { storage } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GymSettings;
  onSaveSettings: (settings: GymSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<GymSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTestSound = () => {
    soundEffects.playReminderChime();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleResetData = () => {
    if (confirm('Tem certeza que deseja restaurar os dados padrão de fábrica? Isso recarregará o sistema com novos dados de demonstração.')) {
      storage.resetAllData();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0d0d0d] border-b border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Configurações da Academia
              </h2>
              <p className="text-xs text-[#777]">Personalize os parâmetros do condomínio e alertas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#777] hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-[#e0e0e0]">
          {/* Condominium & Gym Info */}
          <div className="space-y-3 bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a]">
            <div className="text-xs font-semibold text-[#00F201] flex items-center gap-1.5 uppercase tracking-wider">
              <Building className="w-3.5 h-3.5" />
              <span>Identificação do Condomínio</span>
            </div>

            <div>
              <label className="block text-[#777] font-medium mb-1">Nome do Condomínio</label>
              <input
                type="text"
                required
                value={formData.condoName}
                onChange={(e) => setFormData({ ...formData, condoName: e.target.value })}
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#777] font-medium mb-1">Nome do Espaço / Academia</label>
              <input
                type="text"
                required
                value={formData.gymName}
                onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#777] font-medium mb-1">Localização no Condomínio</label>
              <input
                type="text"
                value={formData.unitAddress}
                onChange={(e) => setFormData({ ...formData, unitAddress: e.target.value })}
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
              />
            </div>
          </div>

          {/* Capacity Settings */}
          <div className="space-y-3 bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a]">
            <div className="text-xs font-semibold text-[#00F201] flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>Capacidade e Limites de Alunos</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#777] font-medium mb-1">Capacidade Máxima</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  required
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono font-bold text-xs focus:border-[#00F201] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#777] font-medium mb-1">Alerta de Atenção (Alunos)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  required
                  value={formData.warningCapacity}
                  onChange={(e) => setFormData({ ...formData, warningCapacity: Number(e.target.value) })}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono font-bold text-xs focus:border-[#00F201] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="space-y-3 bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a]">
            <div className="text-xs font-semibold text-[#00F201] flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>Horário de Funcionamento (Grade de 30min)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#777] font-medium mb-1">Abertura da Academia</label>
                <input
                  type="time"
                  required
                  value={formData.openingTime}
                  onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#00F201] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#777] font-medium mb-1">Fechamento da Academia</label>
                <input
                  type="time"
                  required
                  value={formData.closingTime}
                  onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#00F201] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Alert Sounds */}
          <div className="space-y-3 bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a]">
            <div className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5 uppercase tracking-wider">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Alarme Sonoro de Contagem</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Alerta Sonoro a Cada 30 Minutos</div>
                <div className="text-[11px] text-[#777]">Toca um sinal agradável para lembrar o instrutor</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.soundAlertEnabled}
                  onChange={(e) => setFormData({ ...formData, soundAlertEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1a1a1a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#333] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00F201]"></div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleTestSound}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-[#e0e0e0] rounded-lg text-[11px] font-semibold border border-[#333] transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#00F201]" />
              <span>Testar Som do Alarme</span>
            </button>
          </div>

          {/* Factory Reset */}
          <div className="pt-2 flex justify-between items-center text-[#777] text-[11px]">
            <span>Precisa recomeçar com dados limpos?</span>
            <button
              type="button"
              onClick={handleResetData}
              className="text-[#ff4444] hover:text-red-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar Padrões</span>
            </button>
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#777] hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-lg shadow-md shadow-[#00F201]/20 transition-all active:scale-95 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
