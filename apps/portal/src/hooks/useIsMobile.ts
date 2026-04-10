import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const get = () =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false;
  const [isMobile, setIsMobile] = useState<boolean>(get());

  useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpoint]);

  return isMobile;
}

