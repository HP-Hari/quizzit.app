"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CountdownOptions {
  duration: number;
  onTick?: (remaining: number) => void;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useCountdown({ duration, onTick, onComplete, autoStart = false }: CountdownOptions) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);

  // Keep refs current
  useEffect(() => {
    onTickRef.current = onTick;
    onCompleteRef.current = onComplete;
  }, [onTick, onComplete]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newDuration?: number) => {
    setRemaining(newDuration ?? duration);
    setIsRunning(false);
  }, [duration]);

  const sync = useCallback((serverRemaining: number) => {
    setRemaining(serverRemaining);
  }, []);

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          const next = prev - 1;
          onTickRef.current?.(next);

          if (next <= 0) {
            onCompleteRef.current?.();
            setIsRunning(false);
            return 0;
          }

          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remaining]);

  const progress = duration > 0 ? remaining / duration : 0;

  return {
    remaining,
    isRunning,
    progress,
    start,
    pause,
    reset,
    sync,
  };
}
