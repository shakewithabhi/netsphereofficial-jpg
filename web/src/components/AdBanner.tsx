import { useEffect, useRef } from 'react';
import { useAuth } from '../store/auth';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  style?: React.CSSProperties;
  className?: string;
}

export function AdBanner({ slot, format = 'auto', style, className }: AdBannerProps) {
  const { user } = useAuth();
  const adRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  // Don't show ads for paid users
  const isPaid = user?.plan && user.plan !== 'free';

  useEffect(() => {
    if (isPaid) return;
    if (!pushed.current && adRef.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {
        // AdSense not loaded yet
      }
    }
  }, [isPaid]);

  if (isPaid) return null;

  return (
    <div ref={adRef} className={className} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Sidebar ad (300x250 rectangle) */
export function SidebarAd() {
  return (
    <AdBanner
      slot="SIDEBAR_SLOT_ID"
      format="rectangle"
      className="my-3"
      style={{ minHeight: 250, width: 300 }}
    />
  );
}

/** Horizontal banner (728x90) */
export function HeaderAd() {
  return (
    <AdBanner
      slot="HEADER_SLOT_ID"
      format="horizontal"
      className="my-2"
      style={{ minHeight: 90 }}
    />
  );
}

/** In-feed ad (between file items) */
export function InFeedAd() {
  return (
    <AdBanner
      slot="INFEED_SLOT_ID"
      format="auto"
      className="my-4 mx-auto"
      style={{ minHeight: 120 }}
    />
  );
}
