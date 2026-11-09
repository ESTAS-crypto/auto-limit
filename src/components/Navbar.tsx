'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

interface NavbarProps {
  onRefresh?: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, isSyncing = false }) => {
  const pathname = usePathname();
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => (prev >= 60 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'radar' as const },
    { href: '/akun', label: 'Akun', icon: 'stack' as const },
    { href: '/notifikasi', label: 'Notifikasi', icon: 'bell' as const },
    { href: '/rotasi', label: 'Rotasi', icon: 'loop' as const },
  ];

  return (
    <>
      {/* Top Navigation (Desktop & Tablet) */}
      <div className="rise flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" className="brand disp hover:opacity-90 transition-opacity">
          <i className="logo" />
          <span>Quota Radar</span>
        </Link>

        <nav className="nav hidden md:flex" aria-label="Menu utama">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nv"
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onRefresh}
            className="chip hover:opacity-80 transition-opacity cursor-pointer"
            style={{ '--c': '#4ADE9A' } as React.CSSProperties}
            title="Klik untuk sinkronisasi kuota sekarang"
          >
            <i className={`dot ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              Live · {isSyncing ? 'sinkronisasi...' : `sinkron ${secondsAgo} dtk lalu`}
            </span>
          </button>

          <Link
            href="/tambah-akun"
            className="btn pri hidden sm:inline-flex"
          >
            <Icon name="plus" size={18} />
            <span>Tambah akun</span>
          </Link>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (Height: 84px) */}
      <nav className="tbar md:hidden" aria-label="Menu navigasi ponsel">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="tb"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label === 'Notifikasi' ? 'Notif' : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;

