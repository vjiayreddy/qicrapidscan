import type { Metadata } from "next";
import { ScannerDemo } from "./scanner-demo";

export const metadata: Metadata = {
  title: "Scan — QicRapidScan",
  description: "Live barcode scanner demo for QicRapidScan",
};

export default function ScanPage() {
  return <ScannerDemo />;
}
