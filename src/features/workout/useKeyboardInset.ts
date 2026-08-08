import { useEffect, useState } from "react";

export function useKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateInset = () => {
      setKeyboardInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    };
    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  return keyboardInset;
}
