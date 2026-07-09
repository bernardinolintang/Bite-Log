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
        }}
      >
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: 9999,
            background: "#faf6ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              border: "10px solid #c93a1d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: 9999, background: "#c93a1d" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
