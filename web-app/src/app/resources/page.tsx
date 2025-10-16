import { Suspense } from "react";

import { ResourcesClient } from "@/app/resources/ResourcesClient";

export default function ResourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="text-sm text-white/70">Loading resources…</div>
        </div>
      }
    >
      <ResourcesClient />
    </Suspense>
  );
}
