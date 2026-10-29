'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import styles from './InstallPrompt.module.css';

export function InstallPrompt() {
  const pathname = usePathname();
  const [event, setEvent] = useState<any>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone;
    const handler = (e: Event) => { e.preventDefault(); setEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    setShowIos(isIos);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (pathname !== '/' || dismissed || (!event && !showIos)) return null;
  const install = async () => { if (!event) return; await event.prompt(); await event.userChoice; setEvent(null); };
  return <aside className={styles.prompt} aria-label="Install OTAKUVA"><button className={styles.close} type="button" onClick={() => setDismissed(true)} aria-label="Dismiss"><X size={15} /></button><div className={styles.icon}><Download size={18} /></div><div className={styles.copy}><strong>Install OTAKUVA</strong><span>{showIos ? 'Tap Share, then Add to Home Screen.' : 'Keep OTAKUVA one tap away on your phone.'}</span></div>{event && <button type="button" className={styles.install} onClick={() => void install()}>Install</button>}</aside>;
}
