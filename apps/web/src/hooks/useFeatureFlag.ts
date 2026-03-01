import { useQuery } from "@tanstack/react-query";

interface Feature {
  key: string;
  enabled: boolean;
}

async function fetchFeatures(): Promise<Feature[]> {
  const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";
  const res = await fetch(`${BASE}/features`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

/** Returns true if the named feature flag is enabled. Defaults to false. */
export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ["features"],
    queryFn: fetchFeatures,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
  return data?.find((f) => f.key === key)?.enabled ?? false;
}
