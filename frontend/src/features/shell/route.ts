import { useEffect, useState } from "react";

/* The open page lives in the URL hash (#/assets, #/assetdetail/<id>), so a reload or the back button keeps it */
export interface Route { view: string; id: string | null }

export function parseRoute(hash: string): Route {
  const [view, id] = hash.replace(/^#\/?/, "").split("/");
  return { view: view || "dashboard", id: id ? decodeURIComponent(id) : null };
}

export function routeHash({ view, id }: Route): string {
  return "#/" + view + (id ? "/" + encodeURIComponent(id) : "");
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  function navigate(r: Route) {
    setRoute(r);
    const hash = routeHash(r);
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  return [route, navigate];
}
