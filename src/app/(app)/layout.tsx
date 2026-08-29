import BottomNav from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-lg px-3 pb-28 pt-4 min-[360px]:px-4 safe-top">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
