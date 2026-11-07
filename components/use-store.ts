"use client";
// The store named in the page address (/s/<slug>/...). Only used to build links and request URLs;
// the server checks access on every request, so this is never trusted for permissions.
import { useParams } from "next/navigation";

export function useStorePaths() {
  const { slug } = useParams<{ slug: string }>();
  return {
    slug,
    shop: (p = "") => `/s/${slug}${p}`,
    manage: (p = "") => `/s/${slug}/manage${p}`,
    api: (p: string) => `/api/s/${slug}${p}`,
  };
}
