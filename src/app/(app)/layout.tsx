import BottomNav from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 safe-top">{children}</div>
      <BottomNav />
    </div>
  );
}
