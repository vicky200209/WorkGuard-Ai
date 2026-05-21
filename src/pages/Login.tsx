import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Hammer, Lock, Mail, User, ShieldAlert } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'site_manager' | 'supervisor' | 'worker'>('worker');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick fill helper for testing
  const fillDemoCredentials = (selectedRole: typeof role) => {
    switch (selectedRole) {
      case 'admin':
        setEmail('admin@workguardai.com');
        setPassword('password123');
        setRole('admin');
        break;
      case 'site_manager':
        setEmail('manager@workguardai.com');
        setPassword('password123');
        setRole('site_manager');
        break;
      case 'supervisor':
        setEmail('supervisor@workguardai.com');
        setPassword('password123');
        setRole('supervisor');
        break;
      case 'worker':
        setEmail('worker@workguardai.com');
        setPassword('password123');
        setRole('worker');
        break;
    }
    setErrorMsg(null);
    showToast(`Filled fields for ${selectedRole.replace('_', ' ')}`, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('All fields are required.');
      return;
    }
    if (isSignUp && !fullName) {
      setErrorMsg('Full Name is required for registration.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        // Register standard user
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            }
          }
        });

        if (signUpErr) throw signUpErr;

        if (data.user) {
          // Immediately create row in public.profiles table
          const { error: profileErr } = await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            email: email,
            role: role,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fullName)}`
          });

          if (profileErr) {
            console.error('Error inserting profile row:', profileErr.message);
          }

          showToast('Account registered successfully! You are now logged in.', 'success');
          setIsSignUp(false);
        }
      } else {
        // Sign in standard user
        const resolvedProfile = await login(email, password);
        if (resolvedProfile) {
          showToast(`Welcome back, ${resolvedProfile.full_name}!`, 'success');
          
          // Redirect the user according to their role
          switch (resolvedProfile.role) {
            case 'admin':
              navigate('/admin');
              break;
            case 'site_manager':
              navigate('/manager');
              break;
            case 'supervisor':
              navigate('/supervisor');
              break;
            case 'worker':
              navigate('/worker');
              break;
          }
        }
      }
    } catch (err: any) {
      console.error('Auth action failed:', err);
      setErrorMsg(err?.message || 'Authentication failed. Please verify credentials.');
      showToast(err?.message || 'Verification error, please check details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#12161A] to-amber-500"></div>

      <div className="w-full max-w-md bg-[#11141A] rounded-xl border border-[#222733] shadow-2xl p-8 relative z-10" id="login-container">
        {/* Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-3 animate-pulse">
            <Hammer className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-mono font-black text-white tracking-widest uppercase">
            WorkGuardAi
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1 tracking-wider uppercase">
            Construction Management Platform
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2 font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold uppercase tracking-wide">Error:</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Marcus Brodin"
                  className="w-full bg-[#161B24] border border-[#262E3B] rounded-lg pl-10 pr-4 py-2.5 text-sm font-sans font-medium text-gray-200 placeholder-gray-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                  id="user-fullname"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-[#161B24] border border-[#262E3B] rounded-lg pl-10 pr-4 py-2.5 text-sm font-sans font-medium text-gray-200 placeholder-gray-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                id="user-email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#161B24] border border-[#262E3B] rounded-lg pl-10 pr-4 py-2.5 text-sm font-sans font-medium text-gray-200 placeholder-gray-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                id="user-password"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-[#161B24] border border-[#262E3B] rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-200 focus:outline-hidden focus:border-amber-500 transition-all cursor-pointer font-sans"
                id="user-role-select"
              >
                <option value="worker">Field Worker</option>
                <option value="supervisor">Site Supervisor</option>
                <option value="site_manager">Site Manager</option>
                <option value="admin">HQ Admin</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-gray-700 disabled:text-gray-500 text-[#0F1115] font-mono font-bold py-3 px-4 rounded-lg text-sm tracking-wider uppercase transition-all shadow-md mt-6 flex justify-center items-center gap-2 cursor-pointer"
            id="auth-submit-btn"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
            }}
            className="text-xs font-mono text-amber-500 hover:text-amber-400 tracking-wide underline cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
          </button>
        </div>

        {/* Quick Demo Login Deck */}
        <div className="mt-8 pt-6 border-t border-[#222733]/60">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#888E99] font-bold text-center mb-3">
            Quick Login (Demo)
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <button
              onClick={() => fillDemoCredentials('admin')}
              className="px-2 py-1.5 bg-[#141820] hover:bg-[#1E2532] border border-amber-500/10 rounded font-mono text-[10px] font-bold text-amber-500 cursor-pointer"
            >
              Admin
            </button>
            <button
              onClick={() => fillDemoCredentials('site_manager')}
              className="px-2 py-1.5 bg-[#141820] hover:bg-[#1E2532] border border-sky-400/10 rounded font-mono text-[10px] font-bold text-sky-400 cursor-pointer"
            >
              Manager
            </button>
            <button
              onClick={() => fillDemoCredentials('supervisor')}
              className="px-2 py-1.5 bg-[#141820] hover:bg-[#1E2532] border border-purple-400/10 rounded font-mono text-[10px] font-bold text-purple-400 cursor-pointer"
            >
              Supervisor
            </button>
            <button
              onClick={() => fillDemoCredentials('worker')}
              className="px-2 py-1.5 bg-[#141820] hover:bg-[#1E2532] border border-emerald-400/10 rounded font-mono text-[10px] font-bold text-emerald-400 cursor-pointer"
            >
              Worker
            </button>
          </div>
          <p className="text-[9px] text-gray-500 font-mono text-center mt-3 leading-relaxed">
            Note: Quick-fill applies login text fields. Ensure table profiles with matching emails exist or sign up using the signup link above.
          </p>
        </div>
      </div>
    </div>
  );
}
