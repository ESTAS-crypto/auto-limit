'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Icon, { IconName } from '@/components/Icon';
import Blip from '@/components/Blip';

export default function IkonDanStikerPage() {
  const iconList: { name: IconName; label: string }[] = [
    { name: 'radar', label: 'Dashboard' },
    { name: 'stack', label: 'Akun' },
    { name: 'bell', label: 'Notifikasi' },
    { name: 'loop', label: 'Rotasi' },
    { name: 'plus', label: 'Tambah' },
    { name: 'bolt', label: 'Kuota' },
    { name: 'chat', label: 'Discord' },
    { name: 'shield', label: 'Aman' },
    { name: 'clock', label: 'Reset' },
    { name: 'pause', label: 'Jeda' },
    { name: 'link', label: 'Hubungkan' },
    { name: 'check', label: 'Selesai' },
  ];

  return (
    <div className="pg min-h-screen px-4 md:px-8 py-7 pb-24 md:pb-14">
      <div className="wrap">
        <Navbar />

        <div className="rise mt-10" style={{ '--i': 2 } as React.CSSProperties}>
          <h1 className="h1 text-4xl sm:text-5xl">Ikon dan stiker</h1>
          <p className="sub text-base mt-2">
            Set ikon garis custom dan maskot Blip dengan tiga suasana ekspresi.
          </p>
        </div>

        {/* 12 Custom Icons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3.5 mt-7">
          {iconList.map((item, idx) => (
            <div
              key={item.name}
              className="cell rise"
              style={{ '--i': 3 + idx } as React.CSSProperties}
            >
              <Icon name={item.name} size={34} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* 3 Blip Moods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
          <div
            className="card rise p-6 grid gap-3 justify-items-center text-center"
            style={{ '--i': 16 } as React.CSSProperties}
          >
            <Blip mood="senang" size={120} />
            <span className="sub font-medium">Blip senang · akun sehat (kuota aman)</span>
          </div>

          <div
            className="card rise p-6 grid gap-3 justify-items-center text-center"
            style={{ '--i': 17 } as React.CSSProperties}
          >
            <Blip mood="cemas" size={120} />
            <span className="sub font-medium">Blip cemas · hampir limit (≤ 20%)</span>
          </div>

          <div
            className="card rise p-6 grid gap-3 justify-items-center text-center"
            style={{ '--i': 18 } as React.CSSProperties}
          >
            <Blip mood="tidur" size={120} />
            <span className="sub font-medium">Blip tidur · kena limit (0%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

