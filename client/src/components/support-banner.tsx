import { useQuery } from "@tanstack/react-query";

interface ShopSettings {
  shopName?: string;
  bannerUrl?: string;
}

export function SupportBanner() {
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ["/api/settings/shop"],
  });

  const bannerUrl = settings?.bannerUrl;
  
  if (!bannerUrl) {
    return null;
  }

  return (
    <div className="w-full mb-4 sm:mb-6 flex justify-center px-0">
      <img
        src={bannerUrl}
        alt="Live Support 24/7 - Contact: xt1gy | realmahmut1"
        className="w-full sm:w-auto rounded-md object-contain"
        style={{ maxWidth: '100%', maxHeight: '250px' }}
        data-testid="img-support-banner"
      />
    </div>
  );
}
