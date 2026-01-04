import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';

interface AuthProps { store: any; }

const Auth: React.FC<AuthProps> = ({ store }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([UserRole.MEMBER]);
  
  // CAPTCHA STATE
  const [captcha, setCaptcha] = useState({ q: '', a: 0 });
  const [captchaInput, setCaptchaInput] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { genCaptcha(); }, [isLogin]);

  const genCaptcha = () => {
      const a = Math.floor(Math.random() * 10);
      const b = Math.floor(Math.random() * 10);
      setCaptcha({ q: `${a} + ${b}`, a: a + b });
      setCaptchaInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (isLogin) {
      const res = await store.login(username, password);
      if (!res.success) setError(res.error || 'Login failed');
    } else {
      if (parseInt(captchaInput) !== captcha.a) {
          setError('Incorrect Captcha answer');
          genCaptcha();
          return;
      }
      if (!name.trim() || !username.trim() || roles.length === 0) {
        setError('Missing required fields');
        return;
      }
      const res = await store.signup({ name, username, password, email, roles });
      if (res.success) {
          setSuccess('Signup successful! Wait for admin approval.');
          setIsLogin(true);
      } else {
          setError(res.error || 'Signup failed');
      }
    }
  };

  const toggleRole = (role: UserRole) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-900">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 border border-green-100">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
                <input type="text" placeholder="Full Name" required className="w-full px-4 py-2 border rounded-lg" value={name} onChange={(e) => setName(e.target.value)} />
                <input type="email" placeholder="Email (Optional)" className="w-full px-4 py-2 border rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
            </>
          )}
          <input type="text" placeholder="Username" required className="w-full px-4 py-2 border rounded-lg" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" required className="w-full px-4 py-2 border rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          
          {!isLogin && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase">Select Roles</p>
              <div className="flex flex-wrap gap-2">
                {[UserRole.PROJECT_MANAGER, UserRole.TEAM_LEAD, UserRole.MEMBER].map(role => (
                  <button type="button" key={role} onClick={() => toggleRole(role)} className={`px-3 py-1 text-[10px] font-bold rounded border uppercase ${roles.includes(role)?'bg-indigo-600 text-white':'bg-white text-slate-500'}`}>{role.replace('_',' ')}</button>
                ))}
              </div>
              <div className="flex gap-2 items-center bg-slate-50 p-3 rounded-lg">
                  <span className="text-sm font-bold text-slate-700 select-none">Solve: {captcha.q} = </span>
                  <input type="number" required className="w-20 p-1 border rounded" value={captchaInput} onChange={e=>setCaptchaInput(e.target.value)} />
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold shadow-lg hover:bg-indigo-700">{isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">{isLogin ? "Join now" : 'Sign in'}</button>
        </div>
      </div>
    </div>
  );
};
export default Auth;