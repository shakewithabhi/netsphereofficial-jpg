import { useState } from 'react';
import { Gift } from 'lucide-react';
import { useAuth } from '../store/auth';

/**
 * RewardedAdButton - Shows a "Watch Ad for Extra Storage" button for free-tier users.
 * Uses the Google Interactive Media Ads (IMA) SDK for web rewarded ads.
 * Replace the ad tag URL with your production rewarded ad tag.
 */
export function RewardedAdButton() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  // Only show for free-tier users
  const isPaid = user?.plan && user.plan !== 'free';
  if (isPaid) return null;

  async function handleWatchAd() {
    setLoading(true);
    setRewarded(false);

    try {
      // Google IMA SDK rewarded ad integration
      // In production, replace this with actual IMA SDK ad request
      const google = (window as any).google;
      if (google?.ima) {
        const adDisplayContainer = new google.ima.AdDisplayContainer(
          document.getElementById('rewarded-ad-container')
        );
        adDisplayContainer.initialize();

        const adsLoader = new google.ima.AdsLoader(adDisplayContainer);
        const adsRequest = new google.ima.AdsRequest();
        // Replace with your production rewarded ad tag URL
        adsRequest.adTagUrl =
          'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/rewarded&sz=1x1&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';

        adsLoader.addEventListener(
          google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          (event: any) => {
            const adsManager = event.getAdsManager({ currentTime: 0 });
            adsManager.addEventListener(
              google.ima.AdEvent.Type.COMPLETE,
              () => {
                setRewarded(true);
                setLoading(false);
                // Grant extra storage reward via API
                // Example: await grantRewardedStorage();
              }
            );
            adsManager.addEventListener(
              google.ima.AdErrorEvent.Type.AD_ERROR,
              () => {
                setLoading(false);
              }
            );
            adsManager.init(640, 480, google.ima.ViewMode.NORMAL);
            adsManager.start();
          }
        );

        adsLoader.addEventListener(
          google.ima.AdErrorEvent.Type.AD_ERROR,
          () => {
            setLoading(false);
          }
        );

        adsLoader.requestAds(adsRequest);
      } else {
        // Fallback: IMA SDK not loaded
        console.warn('Google IMA SDK not loaded. Simulating rewarded ad.');
        setTimeout(() => {
          setRewarded(true);
          setLoading(false);
        }, 2000);
      }
    } catch (e) {
      console.error('Rewarded ad error:', e);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleWatchAd}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
      >
        <Gift size={18} />
        {loading ? 'Loading ad...' : 'Watch Ad for Extra Storage'}
      </button>

      {rewarded && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">
          <span>You earned 100 MB of extra storage!</span>
        </div>
      )}

      {/* Hidden container for IMA SDK ad rendering */}
      <div id="rewarded-ad-container" style={{ display: loading ? 'block' : 'none' }} />
    </div>
  );
}
