import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, back, action, description }: {
  title: string;
  back?: string;
  action?: React.ReactNode;
  description?: string;
}) {
  return (
    <header className="mb-6 flex min-w-0 items-start gap-3">
      {back && (
        <Link href={back} className="icon-button mt-0.5" aria-label="Go back">
          <ArrowLeft size={19} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="break-words font-display text-[2rem] leading-[1.08] min-[375px]:text-4xl min-[880px]:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
