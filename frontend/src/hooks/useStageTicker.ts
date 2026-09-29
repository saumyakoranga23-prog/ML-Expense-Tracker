import { useEffect, useRef, useState } from 'react';

/**
 * Rotates through the real phases of a request while it is in flight so the user
 * always sees what the backend is doing ("Processing transactions…",
 * "Running K-Means…"). The first entry of every list is the initial message.
 */
export function useStageTicker(active: boolean, stages: string[], intervalMs = 900): string[] {
  const [index, setIndex] = useState(0);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    setIndex(0);
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, Math.max(stagesRef.current.length - 1, 0)));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);

  if (!active) return stages.slice(0, 1);
  return [...stages.slice(index), ...stages.slice(0, index)];
}
