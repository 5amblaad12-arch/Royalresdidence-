"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const LIST = ["USD", "EUR", "EGP"] as const;

export default function CurrencySwitch({ current }: { current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function pick(c: string) {
    document.cookie = `cur=${c}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    start(() => router.refresh());
  }
  return (
    <div className="cur" role="group" aria-label="Currency" style={{ opacity: pending ? 0.6 : 1 }}>
      {LIST.map((c) => <button key={c} type="button" aria-pressed={current === c} onClick={() => pick(c)}>{c}</button>)}
    </div>
  );
}
