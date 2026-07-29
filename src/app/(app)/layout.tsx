import AppLogo from "@/components/AppLogo";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <header className="flex justify-center px-5 pt-5">
        <AppLogo className="h-12 w-auto" priority />
      </header>
      {children}
      <BottomNav />
    </div>
  );
}
