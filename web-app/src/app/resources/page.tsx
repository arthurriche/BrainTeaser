import { Suspense } from "react";

import { ResourcesClient } from "@/app/resources/ResourcesClient";

export default function ResourcesPage() {
  return (
    <Suspense>
      <ResourcesClient />
    </Suspense>
  );
}
