import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/legal/Workspace";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Munkafelület — Szladits Magánjogi Asszisztens" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <Workspace />,
});
