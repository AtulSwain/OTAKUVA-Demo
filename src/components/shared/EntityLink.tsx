import React from 'react';
import Link from 'next/link';

export type EntityType = 'person' | 'studio' | 'franchise' | 'character';

export interface EntityLinkProps {
  type: EntityType;
  slug: string;
  children: React.ReactNode;
  className?: string;
}

const routeFor: Record<EntityType, string> = {
  person: '/person',
  studio: '/studio',
  franchise: '/franchise',
  character: '/character',
};

export const EntityLink: React.FC<EntityLinkProps> = ({ type, slug, children, className }) => (
  <Link href={`${routeFor[type]}/${slug}`} className={className}>{children}</Link>
);
