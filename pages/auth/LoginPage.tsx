
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../../services/pb';
import { isValidSystemPassword } from '../../core/rules';
import { ClientTypes } from '../../utils/field-standards';
import { Lock, User as UserIcon, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    // Mask: 000.000.000-00
    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    setCpf(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!isValidSystemPassword(password)) {
      setError('A senha deve ter exatamente 5 dígitos.');
      return;
    }

    setLoading(true);
    try {
      // In a real scenario, we might auth by email/cpf. PB defaults to email/username.
      // For this SaaS, we assume 'cpf' is mapped to 'username' or we filter first.
      const authData = await pb.collection('users').authWithPassword(cpf.replace(/\D/g, ''), password);
      
      const userType = authData.record.type as ClientTypes;
      if (userType === ClientTypes.VAREJO) {
        navigate('/store');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError('Credenciais inválidas ou erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 bg-slate-900 text-white text-center">
          <h1 className="text-2xl font-bold tracking-tight">Portal Mercado do Vale</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest">Identidade Digital</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">CPF do Usuário</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                value={cpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Senha (5 dígitos)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                maxLength={5}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                placeholder="•••••"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Sistema'}
          </button>

          <p className="text-center text-xs text-slate-400 uppercase tracking-widest pt-4">
            Acesso Restrito & Auditado
          </p>
        </form>
      </div>
    </div>
  );
};
