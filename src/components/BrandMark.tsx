import { Activity } from "lucide-react";

export default function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
        <Activity aria-hidden="true" size={20} strokeWidth={2.25} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-text">fitlog</span>
    </span>
  );
}
