import { ReactNode } from "react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";

const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-vyva-cream flex justify-center">
      <div className="w-full max-w-[480px] relative">
        <StatusBar />
        <main className="pt-[68px] pb-[84px] overflow-y-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
};

export default AppShell;
