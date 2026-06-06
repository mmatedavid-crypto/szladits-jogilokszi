import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/legal/Workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Szladits Magánjogi Asszisztens" },
      {
        name: "description",
        content:
          "Belső okiratszerkesztési tesztverzió ügyvédi irodák számára — szabálylogikával támogatott adásvételi szerződés tervezet.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Workspace />;
}
