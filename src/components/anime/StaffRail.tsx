'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Briefcase } from 'lucide-react';
import styles from './StaffRail.module.css';

export interface StaffMember {
  name?: string;
  role?: string;
  slug?: string;
  image?: string;
  imageUrl?: string;
  person?: {
    name?: string;
    imageUrl?: string;
    slug?: string;
  };
}

interface StaffRailProps {
  staff?: StaffMember[];
  onViewAll?: () => void;
}



interface StaffCardItemProps {
  person: StaffMember;
  idx: number;
}

const StaffCardItem: React.FC<StaffCardItemProps> = ({ person, idx }) => {
  const [imgError, setImgError] = React.useState(false);

  const rawName = person.name || person.person?.name || 'Creator';
  const name = String(rawName || 'Creator');
  const role = person.role || 'Staff';
  const image = person.image || person.imageUrl || person.person?.imageUrl;
  const initial = (name.trim() || 'C').slice(0, 1).toUpperCase();
  const personSlug = person.slug || person.person?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <Link
      key={name + idx}
      href={`/person/${personSlug}`}
      className={styles.staffCard}
      title={`${name} (${role})`}
    >
      <div className={styles.avatarWrapper}>
        {image && !imgError ? (
          <Image
            src={image}
            alt={name}
            fill
            className={styles.avatarImg}
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {initial}
          </div>
        )}
      </div>

      <span className={styles.staffName}>{name}</span>
      <span className={styles.staffRole}>{role}</span>
    </Link>
  );
};

export const StaffRail: React.FC<StaffRailProps> = ({ staff = [], onViewAll }) => {
  const hasStaff = Array.isArray(staff) && staff.length > 0;

  return (
    <div className={styles.section} aria-label="Staff &amp; Key Creators">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>Staff &amp; Key Creators</h3>
        {onViewAll && hasStaff && (
          <button type="button" className={styles.viewAllLink} onClick={onViewAll} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span>View All</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {!hasStaff ? (
        <div className={styles.emptyContainer}>
          <Briefcase size={18} className={styles.emptyIcon} />
          <span className={styles.emptyText}>Staff and production committee details are being indexed.</span>
        </div>
      ) : (
        <div className={styles.railScroll}>
          {staff.map((person, idx) => (
            <StaffCardItem key={`${person.name || 'staff'}-${idx}`} person={person} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
};
