import Image from "next/image";
import clsx from "clsx";
import taxationLogo from "@/public/brand/taxation-smart.png";
import gobernacionLogo from "@/public/brand/gobernacion-antioquia.png";

/** Placa de vidrio claro sobre la que se apoyan los logos (mantiene su color original legible). */
export function LogoPlate({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-white/95 ring-1 ring-white shadow-[inset_0_1px_0_0_rgb(255_255_255/1),0_6px_18px_-8px_rgb(15_27_45/0.35)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TaxationLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src={taxationLogo} alt="Taxation Smart" className={clsx("h-auto w-full select-none", className)} priority={priority} draggable={false} />;
}

export function GobernacionLogo({ className }: { className?: string }) {
  return <Image src={gobernacionLogo} alt="Gobernación de Antioquia — República de Colombia" className={clsx("h-auto w-full select-none", className)} draggable={false} />;
}
