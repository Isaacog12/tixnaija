import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Payment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardY = spring({ frame, fps, from: 800, to: 0, config: { damping: 14 } });
  
  const p1 = spring({ frame: frame - 30, fps, config: { damping: 12 } });
  const p2 = spring({ frame: frame - 45, fps, config: { damping: 12 } });
  const p3 = spring({ frame: frame - 60, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div 
        className="glass-card"
        style={{
          width: "800px",
          padding: "60px",
          transform: `translateY(${cardY}px)`,
          display: "flex",
          flexDirection: "column",
          gap: "40px"
        }}
      >
        <h2 className="cinzel" style={{ fontSize: "70px", margin: 0 }}>Pay with ease</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "30px", opacity: p1, transform: `translateX(${(1-p1)*50}px)` }}>
            <div style={{ width: "60px", height: "60px", backgroundColor: "var(--primary)", borderRadius: "12px" }} />
            <span style={{ fontSize: "50px", fontWeight: 500 }}>Cards</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "30px", opacity: p2, transform: `translateX(${(1-p2)*50}px)` }}>
            <div style={{ width: "60px", height: "60px", backgroundColor: "var(--accent)", borderRadius: "12px" }} />
            <span style={{ fontSize: "50px", fontWeight: 500 }}>Transfers</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "30px", opacity: p3, transform: `translateX(${(1-p3)*50}px)` }}>
            <div style={{ width: "60px", height: "60px", backgroundColor: "var(--primary)", opacity: 0.5, borderRadius: "12px" }} />
            <span style={{ fontSize: "50px", fontWeight: 500 }}>USSD</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
