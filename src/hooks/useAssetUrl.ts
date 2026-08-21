import { useEffect, useState } from 'react';
import { repo } from '@/services/storageService';

/** Resolves an asset id to an object URL and revokes it on unmount. */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void repo.getAsset(assetId).then((asset) => {
      if (cancelled || !asset) return;
      revoked = URL.createObjectURL(asset.blob);
      setUrl(revoked);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      setUrl(null);
    };
  }, [assetId]);

  return url;
}
