import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface QrCodeImageProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCodeImage({
  value,
  size = 120,
  className,
}: QrCodeImageProps) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#166534",
        light: "#F0FDF4",
      },
    })
      .then((nextSrc) => {
        if (active) setSrc(nextSrc);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
    };
  }, [size, value]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-[10px] text-primary ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        QR loading
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={className}
    />
  );
}
