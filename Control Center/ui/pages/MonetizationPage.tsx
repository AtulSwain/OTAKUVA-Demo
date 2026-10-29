'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Plus, Power, Trash2 } from 'lucide-react';
import { Field, FormSection } from '../Pickers';
import { ImageField } from '../ImageField';
import styles from '../control.module.css';

type Ad = { id: string; title: string; imageUrl: string | null; videoUrl: string | null; clickUrl: string; altText: string | null; enabled: boolean };
type Product = { id: string; title: string; merchant: string; url: string; imageUrl: string | null; price: string | null; enabled: boolean };
const emptyProduct = { title: '', merchant: 'Amazon', url: '', imageUrl: '', price: '', enabled: false };

export function MonetizationPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [animeId, setAnimeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [switches, setSwitches] = useState({ sponsorAdsEnabled: false, commissionsEnabled: false });
  const [ad, setAd] = useState({ title: '', imageUrl: '', videoUrl: '', clickUrl: '', altText: '', enabled: false });
  const [product, setProduct] = useState(emptyProduct);

  const loadAds = useCallback(async () => {
    const response = await fetch('/api/control/sponsor-ads', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setAds(data.ads || []);
  }, []);
  const loadProducts = useCallback(async (key = animeId) => {
    const value = key.trim();
    if (!value) { setProducts([]); return; }
    setProductsLoading(true); setProductsError('');
    try {
      const response = await fetch(`/api/control/commission-products?animeId=${encodeURIComponent(value)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load products.');
      setProducts(data.products || []);
    } catch (error) { setProducts([]); setProductsError((error as Error).message); }
    finally { setProductsLoading(false); }
  }, [animeId]);
  useEffect(() => { void loadAds(); }, [loadAds]);
  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { fetch('/api/control/monetization-settings').then((r) => r.json()).then((d) => setSwitches(d.settings || { sponsorAdsEnabled: false, commissionsEnabled: false })).catch(() => {}); }, []);

  const setSwitch = async (key: 'sponsorAdsEnabled' | 'commissionsEnabled') => {
    const next = { ...switches, [key]: !switches[key] }; setSwitches(next);
    await fetch('/api/control/monetization-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: next[key] }) });
  };
  const createAd = async () => {
    setBusy(true); setMsg('');
    const response = await fetch('/api/control/sponsor-ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ad) });
    const data = await response.json().catch(() => ({})); setMsg(response.ok ? 'Sponsor ad published and visible on the homepage.' : data.error || 'Could not publish sponsor ad.');
    if (response.ok) { setAd({ title: '', imageUrl: '', videoUrl: '', clickUrl: '', altText: '', enabled: false }); await loadAds(); }
    setBusy(false);
  };
  const createProduct = async () => {
    setBusy(true); setMsg('');
    const response = await fetch('/api/control/commission-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...product, animeId: animeId.trim() }) });
    const data = await response.json().catch(() => ({})); setMsg(response.ok ? 'Commission product saved.' : data.error || 'Could not save product.');
    if (response.ok) { setProduct(emptyProduct); await loadProducts(animeId); }
    setBusy(false);
  };
  const toggle = async (kind: 'ads' | 'products', item: Ad | Product) => { const path = kind === 'ads' ? 'sponsor-ads' : 'commission-products'; await fetch(`/api/control/${path}/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) }); kind === 'ads' ? void loadAds() : void loadProducts(); };
  const remove = async (kind: 'ads' | 'products', id: string) => { const path = kind === 'ads' ? 'sponsor-ads' : 'commission-products'; await fetch(`/api/control/${path}/${id}`, { method: 'DELETE' }); kind === 'ads' ? void loadAds() : void loadProducts(); };

  return <div className={styles.page}>
    <header className={styles.head}><p className={styles.kicker}>Monetization</p><h1 className={styles.title}>Ads & commissions</h1><p className={styles.caption}>Nothing is public until you explicitly enable it.</p></header>
    <FormSection title="Sponsor ad" hint="Upload an image from your computer or paste an image URL. You can also use a video URL.">
      <div className={styles.enableBar}><div><strong>Homepage sponsor ads</strong><span>{switches.sponsorAdsEnabled ? 'Enabled — enabled ads may appear above Most Hyped.' : 'Disabled — sponsor ads are hidden.'}</span></div><button type="button" className={switches.sponsorAdsEnabled ? styles.dangerBtn : styles.primary} onClick={() => void setSwitch('sponsorAdsEnabled')}><Power size={15} /> {switches.sponsorAdsEnabled ? 'Disable ad section' : 'Enable ad section'}</button></div>
      <Field label="Sponsor / campaign title" wide><input className={styles.input} value={ad.title} onChange={(e) => setAd({ ...ad, title: e.target.value })} placeholder="Example: Crunchyroll Fall Season" /></Field>
      <div className={styles.fieldWide}><ImageField label="Ad image" kind="banner" shape="banner" value={ad.imageUrl} onChange={(url) => setAd({ ...ad, imageUrl: url })} /></div>
      <Field label="Video URL"><input className={styles.input} value={ad.videoUrl} onChange={(e) => setAd({ ...ad, videoUrl: e.target.value })} placeholder="https://…" /></Field>
      <Field label="Click-through URL"><input className={styles.input} value={ad.clickUrl} onChange={(e) => setAd({ ...ad, clickUrl: e.target.value })} placeholder="https://sponsor.example/…" /></Field>
      <Field label="Accessible description"><input className={styles.input} value={ad.altText} onChange={(e) => setAd({ ...ad, altText: e.target.value })} placeholder="Sponsored message description" /></Field>
      <div className={styles.fieldWide}><button type="button" className={styles.primary} disabled={busy} onClick={() => void createAd()}><Plus size={15} /> {busy ? 'Publishing…' : 'Save & publish sponsor ad'}</button><p className={styles.caption}>Saving publishes this ad immediately above Most Hyped. You can disable it later from the Sponsor ads list.</p></div>
    </FormSection>
    <section className={styles.block}><h2 className={styles.blockTitle}>Sponsor ads</h2><ul className={styles.list}>{ads.map((item) => <li className={styles.userRow} key={item.id}><span className={styles.rowText}><strong>{item.title}</strong><span>{item.videoUrl ? 'Video' : 'Image'} · {item.enabled ? 'Enabled' : 'Disabled'}</span></span><button className={styles.secondary} type="button" onClick={() => void toggle('ads', item)}><Power size={14} /> {item.enabled ? 'Disable' : 'Enable'}</button><button className={styles.iconBtn} type="button" onClick={() => void remove('ads', item.id)} aria-label="Delete sponsor ad"><Trash2 size={15} /></button></li>)}</ul></section>
    <FormSection title="Anime commission products" hint="Enter an anime ID or slug, upload a product image, and add up to 10 Amazon or Flipkart products.">
      <div className={styles.enableBar}><div><strong>Anime commission section</strong><span>{switches.commissionsEnabled ? 'Enabled — visible products may appear below anime pages.' : 'Disabled — commission products are hidden.'}</span></div><button type="button" className={switches.commissionsEnabled ? styles.dangerBtn : styles.primary} onClick={() => void setSwitch('commissionsEnabled')}><Power size={15} /> {switches.commissionsEnabled ? 'Disable commission section' : 'Enable commission section'}</button></div>
      <Field label="Anime ID or slug" wide><div className={styles.addRow}><input className={styles.input} value={animeId} onChange={(e) => setAnimeId(e.target.value)} placeholder="e.g. one-piece" /><button type="button" className={styles.secondary} disabled={!animeId.trim() || productsLoading} onClick={() => void loadProducts()}>{productsLoading ? 'Loading…' : 'Load products'}</button></div>{productsError && <p className={styles.error}>{productsError}</p>}</Field>
      <Field label="Product title"><input className={styles.input} value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} placeholder="Manga box set" /></Field>
      <Field label="Merchant"><select className={styles.selectFull} value={product.merchant} onChange={(e) => setProduct({ ...product, merchant: e.target.value })}><option>Amazon</option><option>Flipkart</option></select></Field>
      <Field label="Product URL" wide><input className={styles.input} value={product.url} onChange={(e) => setProduct({ ...product, url: e.target.value })} placeholder="https://…" /></Field>
      <div className={styles.fieldWide}><ImageField label="Product image" kind="poster" shape="square" value={product.imageUrl} onChange={(url) => setProduct({ ...product, imageUrl: url })} /></div>
      <Field label="Price label"><input className={styles.input} value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} placeholder="₹1,299" /></Field>
      <label className={styles.checkRow}><input type="checkbox" checked={product.enabled} onChange={(e) => setProduct({ ...product, enabled: e.target.checked })} /> Show this product on the anime page</label>
      <div className={styles.fieldWide}><button type="button" className={styles.primary} disabled={busy || !animeId.trim()} onClick={() => void createProduct()}><Plus size={15} /> Add product</button>{msg && <p className={styles.okMsg}>{msg}</p>}</div>
    </FormSection>
    <section className={styles.block}><div className={styles.sectionToolbar}><h2 className={styles.blockTitle}>Products for {animeId || 'selected anime'}</h2><button type="button" className={styles.secondary} disabled={!animeId.trim() || productsLoading} onClick={() => void loadProducts()}>{productsLoading ? 'Loading…' : 'Reload products'}</button></div>{productsError && <p className={styles.error}>{productsError}</p>}{!productsLoading && !productsError && animeId.trim() && products.length === 0 && <p className={styles.caption}>No products found for this anime yet.</p>}<ul className={styles.list}>{products.map((item) => <li className={styles.userRow} key={item.id}><span className={styles.rowText}><strong>{item.title}</strong><span>{item.merchant} {item.price ? `· ${item.price}` : ''} · {item.enabled ? 'Visible' : 'Hidden'}</span></span><a href={item.url} target="_blank" rel="noreferrer" className={styles.inlineLink}><ExternalLink size={14} /> Open</a><button className={styles.secondary} type="button" onClick={() => void toggle('products', item)}>{item.enabled ? 'Hide' : 'Show'}</button><button className={styles.iconBtn} type="button" onClick={() => void remove('products', item.id)} aria-label="Delete product"><Trash2 size={15} /></button></li>)}</ul></section>
  </div>;
}
