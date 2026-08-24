import { Leaf, LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Notice } from '../components/Ui';

export function LoginPage(): React.JSX.Element {
  const { signIn, verifyMfa, setPassword, resetPassword, demo, mfa, passwordFlow } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPasswordValue] = useState(''); const [confirmation, setConfirmation] = useState(''); const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(await signIn(email, password)); setBusy(false); }
  async function reset() { if (!email) { setMessage('Escribí tu correo para recibir el enlace.'); return; } setBusy(true); const error = await resetPassword(email); setMessage(error ?? 'Te enviamos un enlace para restablecer tu contraseña.'); setBusy(false); }
  async function verify(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(await verifyMfa(code)); setBusy(false); }
  async function finishPassword(event: React.FormEvent) { event.preventDefault(); if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return; } setBusy(true); setMessage(await setPassword(password)); setBusy(false); }

  let form: React.ReactNode;
  if (passwordFlow) {
    form = <form className="login-form" onSubmit={(event) => void finishPassword(event)}><p className="eyebrow">{passwordFlow === 'invite' ? 'ACEPTAR INVITACIÓN' : 'RECUPERAR CUENTA'}</p><h2>Creá tu contraseña</h2><p>Usá al menos 12 caracteres. Después de guardarla vas a continuar al panel.</p>{message && <Notice kind="error">{message}</Notice>}<PasswordField label="Nueva contraseña" value={password} onChange={setPasswordValue} /><PasswordField label="Repetir contraseña" value={confirmation} onChange={setConfirmation} /><button className="primary wide" disabled={busy || password.length < 12}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button></form>;
  } else if (mfa) {
    form = <form className="login-form" onSubmit={(event) => void verify(event)}><p className="eyebrow">SEGUNDO FACTOR</p><h2>{mfa.qrCode ? 'Protegé tu cuenta' : 'Verificá tu identidad'}</h2><p>{mfa.qrCode ? 'Escaneá este QR con tu aplicación autenticadora y escribí el código de seis dígitos.' : 'Ingresá el código generado por tu aplicación autenticadora.'}</p>{mfa.qrCode && <div className="mfa-setup"><img src={mfa.qrCode} alt="Código QR para configurar TOTP" />{mfa.secret && <code>{mfa.secret}</code>}</div>}{message && <Notice kind="error">{message}</Notice>}<label>Código TOTP<span><LockKeyhole size={18} /><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" required /></span></label><button className="primary wide" disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Verificar y entrar'}</button></form>;
  } else {
    form = <form className="login-form" onSubmit={(event) => void submit(event)}><p className="eyebrow">PANEL EDITORIAL</p><h2>Iniciar sesión</h2><p>Ingresá con la cuenta a la que recibiste la invitación.</p>{demo && <Notice>Supabase todavía no está configurado. Podés entrar con cualquier dato para explorar el modo demostración.</Notice>}{message && <Notice kind={message.startsWith('Te enviamos') ? 'success' : 'error'}>{message}</Notice>}<label>Correo electrónico<span><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" required={!demo} /></span></label><PasswordField label="Contraseña" value={password} onChange={setPasswordValue} required={!demo} /><button className="primary wide" disabled={busy}>{busy ? 'Ingresando…' : demo ? 'Explorar demostración' : 'Ingresar'}</button><button type="button" className="link-button centered" onClick={() => void reset()}>¿Olvidaste tu contraseña?</button></form>;
  }

  return <div className="login-page"><section className="login-brand"><div className="login-wordmark"><span className="brand-mark"><Leaf /></span><span>Natura UY<small>CATÁLOGO DE BIODIVERSIDAD</small></span></div><div><p className="eyebrow">TRABAJO COLABORATIVO</p><h1>Un catálogo vivo,<br />cuidado entre todos.</h1><p>Revisá datos, documentá fuentes y ayudá a mantener actualizada la biodiversidad de Uruguay.</p></div><small>Acceso exclusivo para colaboradores invitados.</small></section><section className="login-form-wrap">{form}</section></div>;
}

function PasswordField({ label, value, onChange, required = true }: { label: string; value: string; onChange(value: string): void; required?: boolean }) {
  return <label>{label}<span><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="••••••••••••" required={required} /></span></label>;
}
