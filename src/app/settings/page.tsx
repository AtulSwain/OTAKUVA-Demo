'use client';

import React from 'react';
import { Settings, Shield, Bell, Moon } from 'lucide-react';
import styles from './settings.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.settingsPage}>
      <div className={styles.header}>
        <h2 className={styles.title}>Account Settings</h2>
        <p className={styles.subtitle}>Manage your OTAKUVA preferences, spoiler sensitivity, and account details.</p>
      </div>

      <div className={styles.settingsList}>
        <div className={styles.settingCard}>
          <div className={styles.cardHeader}>
            <Moon size={18} className={styles.icon} />
            <div>
              <h3 className={styles.cardTitle}>Theme &amp; Appearance</h3>
              <p className={styles.cardDesc}>OTAKUVA defaults strictly to the signature dark neutral theme.</p>
            </div>
          </div>
          <span className={styles.badge}>Dark Mode (Default)</span>
        </div>

        <div className={styles.settingCard}>
          <div className={styles.cardHeader}>
            <Shield size={18} className={styles.icon} />
            <div>
              <h3 className={styles.cardTitle}>Spoiler Protection</h3>
              <p className={styles.cardDesc}>Automatically blur review text and episode discussion spoilers.</p>
            </div>
          </div>
          <span className={styles.badge}>Enabled</span>
        </div>

        <div className={styles.settingCard}>
          <div className={styles.cardHeader}>
            <Bell size={18} className={styles.icon} />
            <div>
              <h3 className={styles.cardTitle}>Notifications</h3>
              <p className={styles.cardDesc}>Alerts for new episodes of tracked anime and community replies.</p>
            </div>
          </div>
          <span className={styles.badge}>Enabled</span>
        </div>
      </div>
    </div>
  );
}
