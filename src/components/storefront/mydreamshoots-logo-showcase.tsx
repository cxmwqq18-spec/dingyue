"use client";

/* eslint-disable @next/next/no-img-element -- Keep the supplied HTML asset rendering unchanged. */

import type { PointerEvent } from "react";

const logoBase = "/assets/dreamshoot/brand/logo-wall-demo";
const logoAssetVersion = "html-demo-20260830";
const logoRows = [
  [
    ["30-ikraddy.webp", "iKraddy"], ["09-hana-pet.webp", "HANA PET"], ["07-fumei.webp", "FUMEI"], ["15-mrlin.webp", "MRLIN"],
    ["20-popo.webp", "POPO"], ["04-coffee-swap.webp", "COFFEE SWAP"], ["05-ezzy.webp", "EZZY"], ["26-xraz.webp", "XRAZ"],
    ["08-giantdc.webp", "Giantdc"], ["24-smart-check.webp", "SMART Check"], ["22-prevence.webp", "Prevence"], ["10-heart-beat.webp", "HEART BEAT"],
    ["23-shurong-lim.webp", "SHURONG LIM"], ["27-yu-kidsrooms.webp", "YU kidsrooms"], ["14-mr-sdm.webp", "MR.SDM"]
  ],
  [
    ["02-bison.webp", "BISON"], ["25-tosaco.webp", "TOSACO"], ["06-fb.webp", "FB"], ["11-jo.webp", "JO"],
    ["12-laboom.webp", "LABOOM"], ["16-mashtacore.webp", "Mashtacore"], ["17-monkey.webp", "Monkey"], ["13-moonpizza.webp", "MOONPIZZA"],
    ["18-observer.webp", "OBSERVER"], ["19-oficina.webp", "Oficina"], ["21-panda-ber.webp", "Panda BER"], ["28-yx.webp", "YX"],
    ["29-beer.webp", "beer"], ["01-anteater.webp", "Anteater"], ["03-chinawuzhougem.webp", "CHINAWUZHOUGEM"]
  ]
] as const;

function LogoGroup({ duplicate, logos }: { duplicate?: boolean; logos: (typeof logoRows)[number] }) {
  return (
    <div aria-hidden={duplicate ? "true" : undefined} className="mydreamshoots-logo-group">
      {logos.map(([file, label]) => (
        <article className="mydreamshoots-logo-card" key={`${file}-${duplicate ? "duplicate" : "primary"}`}>
          <img alt={duplicate ? "" : `${label} logo`} loading="lazy" src={`${logoBase}/${file}?v=${logoAssetVersion}`} />
        </article>
      ))}
    </div>
  );
}

export function MydreamshootsLogoShowcase({ title }: { title: string }) {
  const updateSpotlight = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--logo-showcase-mx", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--logo-showcase-my", `${event.clientY - bounds.top}px`);
  };

  return (
    <section
      aria-labelledby="mydreamshoots-logo-showcase-title"
      className="mydreamshoots-logo-showcase"
      data-mydreamshoots-logo-showcase="true"
      onPointerMove={updateSpotlight}
    >
      <div aria-hidden="true" className="mydreamshoots-logo-showcase__ambient" />
      <div className="mydreamshoots-logo-showcase__heading" translate="no">
        <div className="mydreamshoots-logo-showcase__eyebrow">CREATIVE SHOWCASE</div>
        <h2 id="mydreamshoots-logo-showcase-title"><span>{title}</span></h2>
        <p>Ideas, brands and visual experiments brought together with AI.</p>
      </div>
      <div aria-label="Logo showcase" className="mydreamshoots-logo-marquee">
        {logoRows.map((logos, rowIndex) => (
          <div className={`mydreamshoots-logo-row mydreamshoots-logo-row--${rowIndex === 0 ? "left" : "right"}`} key={`logo-row-${rowIndex}`}>
            <div className="mydreamshoots-logo-track">
              <LogoGroup logos={logos} />
              <LogoGroup duplicate logos={logos} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
