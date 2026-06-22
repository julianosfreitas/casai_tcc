'use client';

import { cn } from '@/lib/utils';
import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  ArrowRight,
  Mail,
  Home,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  X,
  AlertCircle,
  PartyPopper,
  Loader,
} from 'lucide-react';
import { AnimatePresence, motion, useInView, type Variants } from 'framer-motion';
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from 'canvas-confetti';
import confetti from 'canvas-confetti';
import { api, setTokens } from '@/lib/api';

/* --- CONFETTI --- */
type Api = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = Api | null;

const Confetti = forwardRef<
  ConfettiRef,
  React.ComponentPropsWithRef<'canvas'> & {
    options?: ConfettiOptions;
    globalOptions?: ConfettiGlobalOptions;
    manualstart?: boolean;
  }
>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } =
    props;
  const instanceRef = useRef<ConfettiInstance | null>(null);
  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
      } else if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    },
    [globalOptions],
  );
  const fire = useCallback(
    (opts: ConfettiOptions = {}) => instanceRef.current?.({ ...options, ...opts }),
    [options],
  );
  const apiObj = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => apiObj, [apiObj]);
  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);
  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = 'Confetti';

/* --- BLUR FADE --- */
interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}
function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = true,
  inViewMargin = '-50px',
  blur = '6px',
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as never });
  const isInView = !inView || inViewResult;
  const variants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: 'blur(0px)' },
  };
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      exit="hidden"
      variants={variants}
      transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* --- GLASS BUTTON --- */
const glassButtonVariants = cva('relative isolate all-unset cursor-pointer rounded-full transition-all', {
  variants: {
    size: {
      default: 'text-base font-medium',
      sm: 'text-sm font-medium',
      lg: 'text-lg font-medium',
      icon: 'h-10 w-10',
    },
  },
  defaultVariants: { size: 'default' },
});
const glassButtonTextVariants = cva('glass-button-text relative block select-none tracking-tighter', {
  variants: {
    size: {
      default: 'px-6 py-3.5',
      sm: 'px-4 py-2',
      lg: 'px-8 py-4',
      icon: 'flex h-10 w-10 items-center justify-center',
    },
  },
  defaultVariants: { size: 'default' },
});
export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector('button');
      if (button && e.target !== button) button.click();
    };
    return (
      <div
        className={cn('glass-button-wrap cursor-pointer rounded-full relative', className)}
        onClick={handleWrapperClick}
      >
        <button
          className={cn('glass-button relative z-10', glassButtonVariants({ size }))}
          ref={ref}
          onClick={onClick}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none"></div>
      </div>
    );
  },
);
GlassButton.displayName = 'GlassButton';

/* --- ANIMATED GRADIENT BACKGROUND --- */
const GradientBackground = () => (
  <>
    <style>{`@keyframes float1{0%{transform:translate(0,0)}50%{transform:translate(-10px,10px)}100%{transform:translate(0,0)}}@keyframes float2{0%{transform:translate(0,0)}50%{transform:translate(10px,-10px)}100%{transform:translate(0,0)}}`}</style>
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className="absolute top-0 left-0 w-full h-full"
    >
      <defs>
        <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-3)', stopOpacity: 0.6 }} />
        </linearGradient>
        <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-chart-4)', stopOpacity: 0.9 }} />
          <stop offset="50%" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.7 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-1)', stopOpacity: 0.6 }} />
        </linearGradient>
        <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'var(--color-destructive)', stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-5)', stopOpacity: 0.4 }} />
        </radialGradient>
        <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="35" />
        </filter>
        <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="45" />
        </filter>
      </defs>
      <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
        <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)" />
        <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)" />
      </g>
      <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
        <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.7" />
        <ellipse cx="50" cy="150" rx="180" ry="120" fill="var(--color-accent)" filter="url(#rev_blur2)" opacity="0.8" />
      </g>
    </svg>
  </>
);

/* --- ÍCONE GOOGLE (multicolor oficial) --- */
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-5 h-5" {...props}>
    <g fillRule="evenodd" fill="none">
      <g fillRule="nonzero" transform="translate(3, 2)">
        <path fill="#4285F4" d="M57.8123233,30.1515267 C57.8123233,27.7263183 57.6155321,25.9565533 57.1896408,24.1212666 L29.4960833,24.1212666 L29.4960833,35.0674653 L45.7515771,35.0674653 C45.4239683,37.7877475 43.6542033,41.8844383 39.7213169,44.6372555 L39.6661883,45.0037254 L48.4223791,51.7870338 L49.0290201,51.8475849 C54.6004021,46.7020943 57.8123233,39.1313952 57.8123233,30.1515267" />
        <path fill="#34A853" d="M29.4960833,58.9921667 C37.4599129,58.9921667 44.1456164,56.3701671 49.0290201,51.8475849 L39.7213169,44.6372555 C37.2305867,46.3742596 33.887622,47.5868638 29.4960833,47.5868638 C21.6960582,47.5868638 15.0758763,42.4415991 12.7159637,35.3297782 L12.3700541,35.3591501 L3.26524241,42.4054492 L3.14617358,42.736447 C7.9965904,52.3717589 17.959737,58.9921667 29.4960833,58.9921667" />
        <path fill="#FBBC05" d="M12.7159637,35.3297782 C12.0932812,33.4944915 11.7329116,31.5279353 11.7329116,29.4960833 C11.7329116,27.4640054 12.0932812,25.4976752 12.6832029,23.6623884 L12.6667095,23.2715173 L3.44779955,16.1120237 L3.14617358,16.2554937 C1.14708246,20.2539019 0,24.7439491 0,29.4960833 C0,34.2482175 1.14708246,38.7380388 3.14617358,42.736447 L12.7159637,35.3297782" />
        <path fill="#EB4335" d="M29.4960833,11.4050769 C35.0347044,11.4050769 38.7707997,13.7975244 40.9011602,15.7968415 L49.2255853,7.66898166 C44.1130815,2.91684746 37.4599129,0 29.4960833,0 C17.959737,0 7.9965904,6.62018183 3.14617358,16.2554937 L12.6832029,23.6623884 C15.0758763,16.5505675 21.6960582,11.4050769 29.4960833,11.4050769" />
      </g>
    </g>
  </svg>
);

/* Tipos mínimos do Google Identity Services (carregado via <script>). */
interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_black' | 'filled_blue';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'continue_with';
      width?: number;
      locale?: string;
    },
  ): void;
}
type GoogleAccounts = { accounts: { id: GoogleIdApi } };

/**
 * Slot isolado onde o botão real do GSI é injetado (DOM imperativo).
 * Memoizado com areEqual=()=>true → NUNCA re-renderiza. Sem isso, quando o
 * React reconcilia este nó (que contém o iframe do Google), ele duplica e
 * embaralha os botões vizinhos.
 */
const GsiSlot = React.memo(
  ({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) => (
    <div
      ref={innerRef}
      aria-hidden
      className="absolute inset-0 z-20 flex items-center justify-center opacity-0 [&>*]:!w-full"
    />
  ),
  () => true,
);
GsiSlot.displayName = 'GsiSlot';

/**
 * Botão "Google" no estilo glass do componente, porém FUNCIONAL: o botão
 * oficial do Google Identity Services é renderizado invisível (opacity 0)
 * sobreposto ao glass, capturando o clique e devolvendo o idToken real.
 * Sem NEXT_PUBLIC_GOOGLE_CLIENT_ID configurado, não renderiza nada.
 */
function GlassGoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const google = (window as unknown as { google?: GoogleAccounts }).google;
    const node = overlayRef.current;
    if (!scriptReady || !google || !node || !clientId) return;
    if (node.childElementCount > 0) return; // já renderizado — não duplica
    // GSI pode lançar se o client_id for inválido/origem não autorizada. Isolamos
    // num try/catch pra a falha do Google NUNCA derrubar o front do login (o usuário
    // ainda entra por e-mail/senha). O erro de credencial real aparece no popup do Google.
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      google.accounts.id.renderButton(node, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
        locale: 'pt-BR',
      });
    } catch (err) {
      console.warn('[CASAI] Google Identity Services falhou ao inicializar:', err);
    }
    return () => {
      // StrictMode (dev) monta/desmonta 2x — limpa pra render única.
      node.innerHTML = '';
    };
  }, [scriptReady, clientId]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div className="gsi-glass relative w-full max-w-[320px] mx-auto">
        <GlassButton
          type="button"
          size="lg"
          className="w-full"
          contentClassName="flex items-center justify-center gap-2.5 text-foreground"
        >
          <GoogleIcon className="w-6 h-6" />
          <span className="font-semibold">Entrar com o Google</span>
        </GlassButton>
        {/* Botão real do Google, invisível, capturando o clique. */}
        <GsiSlot innerRef={overlayRef} />
      </div>
    </>
  );
}

type AuthStep = 'email' | 'password' | 'confirmPassword';
type AuthMode = 'signin' | 'signup';

interface AuthComponentProps {
  logo?: React.ReactNode;
  brandName?: string;
}

const DefaultLogo = () => (
  <div className="bg-primary text-primary-foreground rounded-md p-1.5">
    <Home className="h-4 w-4" />
  </div>
);

export const AuthComponent = ({ logo = <DefaultLogo />, brandName = 'CASAI' }: AuthComponentProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('email');
  const [modalStatus, setModalStatus] = useState<'closed' | 'loading' | 'error' | 'success'>('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('Só um instante…');
  const confettiRef = useRef<ConfettiRef>(null);

  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isNameValid = name.trim().length > 0;
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;
  const canAdvanceEmail = isEmailValid && (mode === 'signin' || isNameValid);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const fireSideCanons = useCallback(() => {
    const fire = confettiRef.current?.fire;
    if (!fire) return;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    fire({ ...defaults, particleCount: 50, origin: { x: 0, y: 1 }, angle: 60 });
    fire({ ...defaults, particleCount: 50, origin: { x: 1, y: 1 }, angle: 120 });
  }, []);

  // Sucesso: confete, mensagem e redireciona para o dashboard.
  const onSuccess = useCallback(() => {
    fireSideCanons();
    setModalStatus('success');
    setTimeout(() => router.replace('/dashboard'), 1200);
  }, [fireSideCanons, router]);

  async function doSignIn(emailArg = email, passwordArg = password) {
    setLoadingMsg('Entrando…');
    setModalStatus('loading');
    try {
      const tokens = await api.signIn(emailArg, passwordArg);
      setTokens(tokens.accessToken, tokens.refreshToken);
      onSuccess();
    } catch (err) {
      setModalErrorMessage((err as Error).message);
      setModalStatus('error');
    }
  }

  async function doSignUp() {
    if (password !== confirmPassword) {
      setModalErrorMessage('As senhas não coincidem.');
      setModalStatus('error');
      return;
    }
    setLoadingMsg('Criando sua conta…');
    setModalStatus('loading');
    try {
      const tokens = await api.signUp(email, name.trim(), password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      onSuccess();
    } catch (err) {
      setModalErrorMessage((err as Error).message);
      setModalStatus('error');
    }
  }

  /** Um toque para a banca: entra com o usuário de demonstração do seed. */
  async function demoSignIn() {
    setLoadingMsg('Entrando como demonstração…');
    setModalStatus('loading');
    try {
      const tokens = await api.signIn('dev@casai.local', 'Senha@123');
      setTokens(tokens.accessToken, tokens.refreshToken);
      onSuccess();
    } catch (err) {
      setModalErrorMessage((err as Error).message);
      setModalStatus('error');
    }
  }

  async function googleSignIn(idToken: string) {
    setLoadingMsg('Entrando com o Google…');
    setModalStatus('loading');
    try {
      const tokens = await api.googleSignIn(idToken);
      setTokens(tokens.accessToken, tokens.refreshToken);
      onSuccess();
    } catch (err) {
      setModalErrorMessage((err as Error).message);
      setModalStatus('error');
    }
  }

  // Avança o fluxo passo a passo; no último passo dispara a chamada real.
  function advance() {
    if (authStep === 'email') {
      if (canAdvanceEmail) setAuthStep('password');
      return;
    }
    if (authStep === 'password') {
      if (!isPasswordValid) return;
      if (mode === 'signin') void doSignIn();
      else setAuthStep('confirmPassword');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      advance();
    }
  }

  function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (authStep === 'confirmPassword' && mode === 'signup') void doSignUp();
  }

  function handleGoBack() {
    if (authStep === 'confirmPassword') {
      setAuthStep('password');
      setConfirmPassword('');
    } else if (authStep === 'password') {
      setAuthStep('email');
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setAuthStep('email');
    setPassword('');
    setConfirmPassword('');
  }

  function closeModal() {
    setModalStatus('closed');
    setModalErrorMessage('');
  }

  useEffect(() => {
    if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
    else if (authStep === 'confirmPassword')
      setTimeout(() => confirmPasswordInputRef.current?.focus(), 500);
  }, [authStep]);

  const titles: Record<AuthStep, { title: string; subtitle: string }> = {
    email: {
      title: mode === 'signin' ? 'Bem-vindo de volta' : 'Crie sua conta',
      subtitle: mode === 'signin' ? 'Entre na sua casa inteligente' : 'Comece sua casa inteligente',
    },
    password: { title: 'Sua senha', subtitle: 'A senha precisa ter ao menos 6 caracteres.' },
    confirmPassword: { title: 'Quase lá', subtitle: 'Confirme sua senha para continuar.' },
  };

  const Modal = () => (
    <AnimatePresence>
      {modalStatus !== 'closed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-card/80 border-4 border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2"
          >
            {(modalStatus === 'error' || modalStatus === 'success') && (
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {modalStatus === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-lg font-medium text-foreground text-center">{modalErrorMessage}</p>
                <GlassButton onClick={closeModal} size="sm" className="mt-4">
                  Tentar de novo
                </GlassButton>
              </>
            )}
            {modalStatus === 'loading' && (
              <div className="flex flex-col items-center gap-4">
                <Loader className="w-12 h-12 text-primary animate-spin" />
                <p className="text-lg font-medium text-foreground">{loadingMsg}</p>
              </div>
            )}
            {modalStatus === 'success' && (
              <div className="flex flex-col items-center gap-4">
                <PartyPopper className="w-12 h-12 text-chart-2" />
                <p className="text-lg font-medium text-foreground">Bem-vindo!</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="bg-background min-h-dvh w-full flex flex-col">
      <style>{`
        input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; } input[type="password"]::-webkit-credentials-auto-fill-button, input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; } input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 30px transparent inset !important; -webkit-text-fill-color: var(--foreground) !important; background-color: transparent !important; background-clip: content-box !important; transition: background-color 5000s ease-in-out 0s !important; color: var(--foreground) !important; caret-color: var(--foreground) !important; } input:autofill { background-color: transparent !important; background-clip: content-box !important; -webkit-text-fill-color: var(--foreground) !important; color: var(--foreground) !important; }
        @property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; } @property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
        .glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); } .glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); } /* all-unset zera a largura do button → ele vira content-width e a sombra (do wrapper) vaza. Especificidade 0,2,0 vence o all-unset (0,1,0) e faz o botão preencher o wrapper. */ .glass-button-wrap > .glass-button { width: 100%; } .glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; } .glass-button-shadow::after { content: ""; position: absolute; inset: calc(var(--shadow-cutoff-fix) / 2); border-radius: 9999px; background: linear-gradient(180deg, oklch(from var(--foreground) l c h / 20%), oklch(from var(--foreground) l c h / 10%)); transform: translateY(0.12em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
        .glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); } .glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); } .glass-button-text { color: oklch(from var(--foreground) l c h / 90%); text-shadow: 0em 0.25em 0.05em oklch(from var(--foreground) l c h / 10%); transition: all var(--anim-time) var(--anim-ease); } .glass-button:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em oklch(from var(--foreground) l c h / 12%); } .glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); } .glass-button:hover .glass-button-text::after { background-position: 25% 50%; } .glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; } .glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; } .glass-button:hover::after { --angle-1: -125deg; } .glass-button:active::after { --angle-1: -75deg; }
        /* Botão Google: o overlay GSI cobre o glass e rouba o :hover. Estas regras
           reproduzem o hover quando o wrapper inteiro (incluindo o overlay) é apontado. */
        .gsi-glass:hover .glass-button { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); } .gsi-glass:hover .glass-button::after { --angle-1: -125deg; } .gsi-glass:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em oklch(from var(--foreground) l c h / 12%); } .gsi-glass:hover .glass-button-text::after { background-position: 25% 50%; } .gsi-glass:active .glass-button { transform: scale(0.97); } @media (hover: none) and (pointer: coarse) { .glass-button::after, .glass-button:hover::after, .glass-button:active::after { --angle-1: -75deg; } .glass-button .glass-button-text::after, .glass-button:active .glass-button-text::after { --angle-2: -45deg; } }
        .glass-input-wrap { position: relative; z-index: 2; transform-style: preserve-3d; border-radius: 9999px; } .glass-input { display: flex; position: relative; width: 100%; align-items: center; gap: 0.5rem; border-radius: 9999px; padding: 0.25rem; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); } .glass-input-wrap:focus-within .glass-input { backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); } .glass-input::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + clamp(1px, 0.0625em, 4px)); height: calc(100% + clamp(1px, 0.0625em, 4px)); top: calc(0% - clamp(1px, 0.0625em, 4px) / 2); left: calc(0% - clamp(1px, 0.0625em, 4px) / 2); padding: clamp(1px, 0.0625em, 4px); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(clamp(1px, 0.0625em, 4px) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; } .glass-input-wrap:focus-within .glass-input::after { --angle-1: -125deg; }
      `}</style>

      <Confetti
        ref={confettiRef}
        manualstart
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]"
      />
      <Modal />

      <div className={cn('fixed top-4 left-4 z-20 flex items-center gap-2', 'md:left-1/2 md:-translate-x-1/2')}>
        {logo}
        <h1 className="text-base font-bold text-foreground">{brandName}</h1>
      </div>

      <div className={cn('flex w-full flex-1 h-full items-center justify-center bg-card', 'relative overflow-hidden')}>
        <div className="absolute inset-0 z-0">
          <GradientBackground />
        </div>
        <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[300px] mx-auto p-4">
          {/* Títulos por passo */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${mode}-${authStep}-title`}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full flex flex-col items-center text-center gap-2"
            >
              <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground">
                {titles[authStep].title}
              </p>
              <p className="text-sm font-medium text-muted-foreground">{titles[authStep].subtitle}</p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleFinalSubmit} className="w-full space-y-6">
            {/* Passo e-mail (+ nome no cadastro) */}
            {authStep === 'email' && (
              <motion.div
                key="email-fields"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full space-y-6"
              >
                {mode === 'signup' && (
                  <BlurFade className="w-full">
                    <div className="glass-input-wrap w-full">
                      <div className="glass-input">
                        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                          <User className="h-5 w-5 text-foreground/80" />
                        </div>
                        <input
                          type="text"
                          autoComplete="name"
                          placeholder="Seu nome"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none pr-3"
                        />
                      </div>
                    </div>
                  </BlurFade>
                )}
                <BlurFade className="w-full">
                  <div className="glass-input-wrap w-full">
                    <div className="glass-input">
                      <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                        <Mail className="h-5 w-5 text-foreground/80" />
                      </div>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                      />
                      <div
                        className={cn(
                          'relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out',
                          canAdvanceEmail ? 'w-10 pr-1' : 'w-0',
                        )}
                      >
                        <GlassButton
                          type="button"
                          onClick={advance}
                          size="icon"
                          aria-label="Continuar"
                          contentClassName="text-foreground/80 hover:text-foreground"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </GlassButton>
                      </div>
                    </div>
                  </div>
                </BlurFade>

                <BlurFade className="w-full">
                  <div className="flex items-center w-full gap-2">
                    <hr className="w-full border-border" />
                    <span className="text-xs font-semibold text-muted-foreground">ou</span>
                    <hr className="w-full border-border" />
                  </div>
                </BlurFade>

                <BlurFade className="w-full flex flex-col items-center gap-3">
                  <GlassGoogleButton onCredential={googleSignIn} />
                  <GlassButton
                    type="button"
                    onClick={demoSignIn}
                    size="sm"
                    className="w-full max-w-[320px] mx-auto"
                    contentClassName="flex items-center justify-center gap-2 text-foreground"
                  >
                    🚀 Entrar como demonstração
                  </GlassButton>
                </BlurFade>
              </motion.div>
            )}

            {/* Passo senha */}
            {authStep === 'password' && (
              <BlurFade key="password-field" className="w-full">
                <div className="glass-input-wrap w-full">
                  <div className="glass-input">
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      {isPasswordValid ? (
                        <button
                          type="button"
                          aria-label="Mostrar ou ocultar senha"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-foreground/80 hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      ) : (
                        <Lock className="h-5 w-5 text-foreground/80" />
                      )}
                    </div>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="Senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                    />
                    <div
                      className={cn(
                        'relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out',
                        isPasswordValid ? 'w-10 pr-1' : 'w-0',
                      )}
                    >
                      <GlassButton
                        type="button"
                        onClick={advance}
                        size="icon"
                        aria-label={mode === 'signin' ? 'Entrar' : 'Continuar'}
                        contentClassName="text-foreground/80 hover:text-foreground"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </GlassButton>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              </BlurFade>
            )}

            {/* Passo confirmar senha (cadastro) */}
            {authStep === 'confirmPassword' && (
              <BlurFade key="confirm-field" className="w-full">
                <div className="glass-input-wrap w-full">
                  <div className="glass-input">
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      {isConfirmPasswordValid ? (
                        <button
                          type="button"
                          aria-label="Mostrar ou ocultar senha"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-foreground/80 hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      ) : (
                        <Lock className="h-5 w-5 text-foreground/80" />
                      )}
                    </div>
                    <input
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Confirme a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                    />
                    <div
                      className={cn(
                        'relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out',
                        isConfirmPasswordValid ? 'w-10 pr-1' : 'w-0',
                      )}
                    >
                      <GlassButton
                        type="submit"
                        size="icon"
                        aria-label="Concluir cadastro"
                        contentClassName="text-foreground/80 hover:text-foreground"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </GlassButton>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              </BlurFade>
            )}
          </form>

          {/* Alternar entre entrar e cadastrar */}
          {authStep === 'email' && (
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === 'signin' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </button>
          )}
        </fieldset>
      </div>
    </div>
  );
};
