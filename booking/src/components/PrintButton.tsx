"use client";
export default function PrintButton({ label = "Download / print receipt" }: { label?: string }) {
  return <button type="button" className="btn-primary" onClick={() => window.print()}>{label}</button>;
}
