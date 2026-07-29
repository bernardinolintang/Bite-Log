import Image from "next/image";

type AppLogoProps = {
  className?: string;
  priority?: boolean;
};

export default function AppLogo({ className = "h-14 w-auto", priority = false }: AppLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="BiteLog"
      width={320}
      height={120}
      className={className}
      priority={priority}
    />
  );
}
