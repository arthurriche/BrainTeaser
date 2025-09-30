import type { Metadata } from "next";
import { RiddleClient } from "./RiddleClient";

export const metadata: Metadata = {
  title: "Enigmate — Résolution",
};

export default function RiddlePage() {
  return <RiddleClient />;
}
