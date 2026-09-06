import { Check, Copy, Leaf, LockKeyhole, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Notice } from '../components/Ui';

export function LoginPage(): React.JSX.Element {
  const { signIn, signInWithGoogle, verifyMfa, setPassword, resetPassword, signOut, mfa, passwordFlow } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPasswordValue] = useState(''); const [confirmation, setConfirmation] = useState(''); const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(await signIn(email, password)); setBusy(false); }
  async function reset() { if (!email) { setMessage('Escribí tu correo para recibir el enlace.'); return; } setBusy(true); const error = await resetPassword(email); setMessage(error ?? 'Te enviamos un enlace para restablecer tu contraseña.'); setBusy(false); }
  async function verify(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(await verifyMfa(code)); setBusy(false); }
  async function finishPassword(event: React.FormEvent) { event.preventDefault(); if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return; } setBusy(true); setMessage(await setPassword(password)); setBusy(false); }
  async function copySecret() {
    if (!mfa?.secret) return;
    try { await navigator.clipboard.writeText(mfa.secret); setCopied(true); }
    catch { setMessage('No pudimos copiar la clave. Seleccionala y copiala manualmente.'); }
  }

  let form: React.ReactNode;
  if (passwordFlow) {
    form = <form className="login-form" onSubmit={(event) => void finishPassword(event)}><p className="eyebrow">{passwordFlow === 'invite' ? 'ACEPTAR INVITACIÓN' : 'RECUPERAR CUENTA'}</p><h2>Creá tu contraseña</h2><p>Usá al menos 12 caracteres. Después de guardarla vas a continuar al panel.</p>{message && <Notice kind="error">{message}</Notice>}<PasswordField label="Nueva contraseña" value={password} onChange={setPasswordValue} /><PasswordField label="Repetir contraseña" value={confirmation} onChange={setConfirmation} /><button className="primary wide" disabled={busy || password.length < 12}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button></form>;
  } else if (mfa) {
    const enrolling = mfa.mode === 'enroll';
    form = <form className="login-form mfa-form" onSubmit={(event) => void verify(event)}>
      <p className="eyebrow">SEGURIDAD DE LA CUENTA</p>
      <h2>{enrolling ? 'Configurá el segundo factor' : 'Confirmá que sos vos'}</h2>
      <p>{enrolling ? 'Tu cuenta tiene permisos de administrador. Para proteger el catálogo, vinculá una aplicación autenticadora. Esto se configura una sola vez.' : 'Esta cuenta tiene una aplicación autenticadora vinculada. Abrila para obtener el código actual.'}</p>
      {enrolling ? <>
        <ol className="mfa-steps">
          <li><span>1</span><p><strong>Abrí una aplicación autenticadora</strong><small>Puede ser Google Authenticator, Microsoft Authenticator, Authy o 1Password.</small></p></li>
          <li><span>2</span><p><strong>Agregá una cuenta y escaneá el QR</strong><small>La aplicación guardará una entrada llamada Natura UY.</small></p></li>
          <li><span>3</span><p><strong>Ingresá abajo los seis dígitos</strong><small>El código cambia cada 30 segundos.</small></p></li>
        </ol>
        {mfa.qrCode && <div className="mfa-setup"><img src={mfa.qrCode} alt="Código QR para vincular Natura UY con una aplicación autenticadora" /></div>}
        {mfa.secret && <details className="mfa-manual"><summary>No puedo escanear el QR</summary><p>Elegí “Ingresar clave” en tu aplicación y usá esta clave manual:</p><div><code>{mfa.secret}</code><button type="button" className="icon-button" title="Copiar clave manual" aria-label="Copiar clave manual" onClick={() => void copySecret()}>{copied ? <Check /> : <Copy />}</button></div></details>}
      </> : <div className="mfa-guidance"><Smartphone /><p><strong>Buscá “Natura UY” en tu autenticador</strong><small>El código no llega por correo ni por SMS. Es el número de seis dígitos que muestra esa aplicación.</small></p></div>}
      <div className="mfa-note"><ShieldCheck /><span>{enrolling ? 'No cierres esta pantalla hasta confirmar el primer código.' : 'Si no recordás haber configurado esto, vas a necesitar restablecer el autenticador antes de entrar.'}</span></div>
      {message && <Notice kind="error">{message}</Notice>}
      <label>Código de 6 dígitos<span><LockKeyhole size={18} /><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setMessage(null); }} placeholder="000000" aria-describedby="mfa-code-help" required /></span></label>
      <small id="mfa-code-help" className="mfa-code-help">Usá el código vigente; no ingreses tu contraseña ni un código recibido por email.</small>
      <button className="primary wide" disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : enrolling ? 'Activar y entrar' : 'Verificar y continuar'}</button>
      <button type="button" className="link-button centered" disabled={busy} onClick={() => void signOut()}>Salir y usar otra cuenta</button>
    </form>;
  } else {
    form = <form className="login-form" onSubmit={(event) => void submit(event)}><p className="eyebrow">PANEL EDITORIAL</p><h2>Iniciar sesión</h2><p>Ingresá con una cuenta que tenga invitación editorial activa.</p>{message && <Notice kind={message.startsWith('Te enviamos') ? 'success' : 'error'}>{message}</Notice>}<button type="button" className="secondary wide" disabled={busy} onClick={() => void signInWithGoogle().then(setMessage)}>Continuar con Google</button><label>Correo electrónico<span><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" required /></span></label><PasswordField label="Contraseña" value={password} onChange={setPasswordValue} /><button className="primary wide" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button><button type="button" className="link-button centered" onClick={() => void reset()}>¿Olvidaste tu contraseña?</button></form>;
  }

  return <div className="login-page"><section className="login-brand"><div className="login-wordmark"><span className="brand-mark"><Leaf /></span><span>Natura UY<small>CATÁLOGO DE BIODIVERSIDAD</small></span></div><div><p className="eyebrow">TRABAJO COLABORATIVO</p><h1>Un catálogo vivo,<br />cuidado entre todos.</h1><p>Revisá datos, documentá fuentes y ayudá a mantener actualizada la biodiversidad de Uruguay.</p></div><small>Acceso exclusivo para colaboradores invitados.</small></section><section className="login-form-wrap">{form}</section></div>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label>{label}<span><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="••••••••••••" required /></span></label>;
}
