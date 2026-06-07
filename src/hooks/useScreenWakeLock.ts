/**
 * @file useScreenWakeLock
 * @description Screen Wake Lock API で画面スリープを抑止する。
 *   タイマー稼働中など、enabled が true の間だけロックを維持する。
 * @limitation Wake Lock 非対応ブラウザでは何もしない。タブ非表示時は OS がロックを解除する。
 */
import { useEffect, useRef } from "react";

/**
 * Wake Lock を要求する
 * @param {WakeLockSentinel | null} current - 既存ロック
 * @returns {Promise<WakeLockSentinel | null>} 取得したロック。失敗時 null
 */
async function requestWakeLock(
  current: WakeLockSentinel | null,
): Promise<WakeLockSentinel | null> {
  if (!("wakeLock" in navigator)) {
    return null;
  }
  if (current && !current.released) {
    return current;
  }
  try {
    return await navigator.wakeLock.request("screen");
  } catch (error) {
    console.warn(
      "useScreenWakeLock: Wake Lock の取得に失敗しました",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Wake Lock を解放する
 * @param {WakeLockSentinel | null} sentinel - 解放対象
 */
async function releaseWakeLock(sentinel: WakeLockSentinel | null): Promise<void> {
  if (!sentinel || sentinel.released) return;
  try {
    await sentinel.release();
  } catch (error) {
    console.warn(
      "useScreenWakeLock: Wake Lock の解放に失敗しました",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * enabled が true の間、画面がスリープしないようにする
 * @param {boolean} enabled - true の間 Wake Lock を維持
 */
export function useScreenWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      void releaseWakeLock(sentinelRef.current).then(() => {
        sentinelRef.current = null;
      });
      return;
    }

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || !enabledRef.current || document.visibilityState !== "visible") {
        return;
      }
      const lock = await requestWakeLock(sentinelRef.current);
      if (cancelled || !enabledRef.current) {
        await releaseWakeLock(lock);
        return;
      }
      sentinelRef.current = lock;
    };

    void acquire();

    /** タブ復帰時に Wake Lock を再取得する */
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabledRef.current) {
        sentinelRef.current = null;
        void acquire();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock(sentinelRef.current).then(() => {
        sentinelRef.current = null;
      });
    };
  }, [enabled]);
}
