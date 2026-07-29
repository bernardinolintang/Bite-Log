import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c93a1d",
          borderRadius: 36,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: "#faf6ef",
          }}
        />
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 9999,
            border: "10px solid #faf6ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 2,
              height: 92,
              background: "#faf6ef",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 34,
              width: 44,
              height: 52,
              borderRadius: "50% 50% 45% 45%",
              background: "#c93a1d",
              border: "3px solid #211d18",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 24,
              width: 16,
              height: 12,
              background: "#211d18",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 28,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ width: 44, height: 8, borderRadius: 4, background: "#faf6ef" }} />
            <div style={{ width: 44, height: 8, borderRadius: 4, background: "#faf6ef" }} />
            <div style={{ width: 44, height: 8, borderRadius: 4, background: "#faf6ef" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
