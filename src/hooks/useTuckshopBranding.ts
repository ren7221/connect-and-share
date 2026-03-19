import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface TuckshopBranding {
  name: string;
  logo_url: string | null;
  brand_color: string;
}

export function useTuckshopBranding() {
  const { tuckshopId } = useAuth();
  const [branding, setBranding] = useState<TuckshopBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tuckshopId) { setLoading(false); return; }
    supabase
      .from("tuckshops")
      .select("name, logo_url, brand_color")
      .eq("id", tuckshopId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBranding({ name: data.name, logo_url: data.logo_url, brand_color: data.brand_color ?? "#16a34a" });
        setLoading(false);
      });
  }, [tuckshopId]);

  return { branding, loading };
}
