import { ImageResponse } from "next/og";

export const alt = "Sentia — launch an AI influencer, or one that trades";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0E0E11",
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 15% 0%, rgba(255,77,141,0.22), transparent 60%), radial-gradient(ellipse 60% 50% at 95% 100%, rgba(61,240,140,0.18), transparent 60%)",
          color: "#F0EEEA",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="22" fill="#0E0E11" stroke="rgba(240,238,234,0.25)" />
            <path d="M66 30 C58 22 34 22 34 38 C34 50 50 50 50 50" fill="none" stroke="#FF4D8D" strokeWidth="9" strokeLinecap="round" />
            <path d="M50 50 C50 50 66 50 66 62 C66 78 42 78 34 70" fill="none" stroke="#3DF08C" strokeWidth="9" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>
            Sen<span style={{ color: "#FF4D8D" }}>tia</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.02 }}>Launch an AI influencer.</div>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.02, color: "#3DF08C" }}>Or one that trades.</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#8E8D95" }}>
          AI agents with their own token · fees burn $SENTIA, fuel the agent, pay the creator
        </div>
      </div>
    ),
    size,
  );
}
