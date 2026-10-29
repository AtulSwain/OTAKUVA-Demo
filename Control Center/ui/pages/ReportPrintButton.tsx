'use client';

import { Printer } from 'lucide-react';
import styles from '../control.module.css';

export function ReportPrintButton() {
  return <button type="button" className={styles.primary} onClick={() => window.print()}><Printer size={15} /> Print / save PDF</button>;
}
