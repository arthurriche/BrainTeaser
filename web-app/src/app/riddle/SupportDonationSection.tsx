"use client";

import { type ChangeEvent, useMemo, useState } from "react";

const MIN_DONATION_CENTS = 100;
const MAX_DONATION_CENTS = 5000;
const DONATION_STEP_CENTS = 100;

export const SupportDonationSection = ({
  onCheckout,
  label,
  helper,
  pledging,
  errorMessage,
}: {
  onCheckout: (amountCents: number) => void;
  label: string;
  helper: string;
  pledging: boolean;
  errorMessage: string | null;
}) => {
  const [amountCents, setAmountCents] = useState(500);
  const formattedAmount = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(amountCents / 100),
    [amountCents],
  );

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(nextValue)) {
      setAmountCents(nextValue);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg">
      <p className="text-sm font-semibold text-white/80">{label}</p>
      <p className="mt-1 text-xs text-white/60">{helper}</p>

      <div className="mt-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">Amount</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={MIN_DONATION_CENTS}
            max={MAX_DONATION_CENTS}
            step={DONATION_STEP_CENTS}
            value={amountCents}
            onChange={handleSliderChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-amber-300"
            disabled={pledging}
          />
          <span className="min-w-[70px] text-sm font-semibold text-white">{formattedAmount}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300 disabled:cursor-not-allowed disabled:opacity-70"
        onClick={() => onCheckout(amountCents)}
        disabled={pledging}
      >
        {pledging ? "Redirecting…" : "Contribute via Stripe"}
      </button>

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {errorMessage}
        </p>
      ) : (
        <p className="mt-3 text-xs text-white/60">Stripe Checkout handles cards and wallets securely.</p>
      )}
    </div>
  );
};
